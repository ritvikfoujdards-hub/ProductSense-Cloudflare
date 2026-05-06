import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers"

export interface EnrichmentParams {
  id: string
  text: string
  source: string
  author: string
  customer_tier: string
  now: string
}

interface Env {
  DB: D1Database
  AI: Ai
  VECTORIZE: VectorizeIndex
}

const VALID_THEMES = ["Performance", "Reliability", "Pricing", "DX", "Bugs"]
const CLUSTER_SIMILARITY_THRESHOLD = 0.75

// ─────────────────────────────────────────────────────────────────────────────
// EnrichmentWorkflow
//
// Triggered by the ingest worker immediately after the raw D1 write.
// Runs entirely in the background — the HTTP 201 has already been returned.
//
// Steps (each independently retried on failure):
//   1. llama-enrichment   — sentiment / urgency / theme via llama-3.1-8b-instruct
//   2. update-d1-scores   — write enriched scores back to D1 enrichment row
//   3. bge-embedding      — 384-dim vector via bge-small-en-v1.5
//   4. vectorize-upsert   — store vector + update enrichment.vector_id in D1
//   5. knn-cluster        — find similar items → assign to signal → rescore → re-rank
// ─────────────────────────────────────────────────────────────────────────────
export class EnrichmentWorkflow extends WorkflowEntrypoint<Env, EnrichmentParams> {
  async run(event: WorkflowEvent<EnrichmentParams>, step: WorkflowStep) {
    const { id, text, source, customer_tier, now } = event.payload

    // ── Step 1: llama-3.1-8b-instruct ────────────────────────────────────────
    const enrichment = await step.do(
      "llama-enrichment",
      { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
      async () => {
        const response = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            {
              role: "system",
              content: `You are a product analytics AI. Analyze the customer feedback and return ONLY a valid JSON object with exactly these three fields:
{
  "sentiment_score": <float -1.0 to 1.0>,
  "urgency_score": <float 0.0 to 1.0, where 1.0 means the user is blocked or in a production outage>,
  "theme": <exactly one of: "Performance", "Reliability", "Pricing", "DX", "Bugs">
}
Output nothing else. No prose, no markdown fences.`,
            },
            {
              role: "user",
              content: `Customer tier: ${customer_tier}\nSource: ${source}\nFeedback: ${text}`,
            },
          ],
          max_tokens: 100,
        })

        const raw = ((response as { response: string }).response ?? "").trim()
        const match = raw.match(/\{[\s\S]*?\}/)
        if (!match) {
          // Return safe defaults — step will NOT retry on a return, only on throw
          return { sentiment_score: 0, urgency_score: 0.3, theme: "Bugs" }
        }
        const parsed = JSON.parse(match[0])
        return {
          sentiment_score: Math.max(-1, Math.min(1, Number(parsed.sentiment_score) || 0)),
          urgency_score:   Math.max(0,  Math.min(1, Number(parsed.urgency_score)   || 0.3)),
          theme:           VALID_THEMES.includes(parsed.theme) ? parsed.theme : "Bugs",
        }
      }
    )

    const sentiment =
      enrichment.sentiment_score < -0.3 ? "negative" :
      enrichment.sentiment_score >  0.3 ? "positive" : "neutral"

    // ── Step 2: Write enriched scores to D1 ──────────────────────────────────
    await step.do("update-d1-scores", async () => {
      await this.env.DB
        .prepare("UPDATE enrichment SET sentiment_score=?, urgency_score=?, sentiment=? WHERE id=?")
        .bind(enrichment.sentiment_score, enrichment.urgency_score, sentiment, id)
        .run()
    })

    // ── Step 3: bge-small-en-v1.5 embedding ──────────────────────────────────
    const vector = await step.do(
      "bge-embedding",
      { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } },
      async () => {
        const response = await this.env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [text] })
        return ((response as { data: number[][] }).data)[0]
      }
    )

    // ── Step 4: Vectorize upsert ──────────────────────────────────────────────
    await step.do("vectorize-upsert", async () => {
      await this.env.VECTORIZE.upsert([{
        id,
        values: vector,
        metadata: { source, customer_tier, sentiment, theme: enrichment.theme, ingested_at: now },
      }])
      await this.env.DB
        .prepare("UPDATE enrichment SET vector_id=? WHERE id=?")
        .bind(id, id)
        .run()
    })

    // ── Step 5: KNN clustering ────────────────────────────────────────────────
    // Query the index for the 10 nearest neighbors. If enough similar items
    // belong to an existing signal, assign this item to that signal and
    // recompute its score + brief rank.
    await step.do("knn-cluster", async () => {
      const results = await this.env.VECTORIZE.query(vector, {
        topK: 10,
        returnMetadata: "indexed",
      })

      const neighbors = (results.matches ?? []).filter(
        (m) => m.id !== id && (m.score ?? 0) >= CLUSTER_SIMILARITY_THRESHOLD
      )
      if (!neighbors.length) return

      // Find which signal owns the most neighbor items
      const neighborIds = neighbors.map((m) => m.id)
      const placeholders = neighborIds.map(() => "?").join(",")
      const signalMatch = await this.env.DB
        .prepare(
          `SELECT si.signal_id, COUNT(*) AS cnt
           FROM signal_items si
           WHERE si.item_id IN (${placeholders})
           GROUP BY si.signal_id
           ORDER BY cnt DESC
           LIMIT 1`
        )
        .bind(...neighborIds)
        .first<{ signal_id: string; cnt: number }>()

      if (!signalMatch) return
      const { signal_id } = signalMatch

      // Add new item to signal (idempotent via OR IGNORE)
      const insertResult = await this.env.DB
        .prepare("INSERT OR IGNORE INTO signal_items (signal_id, item_id) VALUES (?,?)")
        .bind(signal_id, id)
        .run()

      // Only recompute if we actually inserted a new row
      if (!insertResult.meta.changes) return

      await this.env.DB
        .prepare("UPDATE signals SET item_count = item_count + 1 WHERE id=?")
        .bind(signal_id)
        .run()

      // Recompute source_weight_avg using active policy
      const policy = await this.env.DB
        .prepare("SELECT source_weights, theme_boosts FROM weighting_policies WHERE is_active=1 LIMIT 1")
        .first<{ source_weights: string; theme_boosts: string }>()
      if (!policy) return

      const weights = JSON.parse(policy.source_weights) as Record<string, number>
      const themeBoostList = JSON.parse(policy.theme_boosts) as string[]

      const sourceCounts = await this.env.DB
        .prepare(
          `SELECT e.source, COUNT(*) AS cnt
           FROM signal_items si JOIN enrichment e ON e.id = si.item_id
           WHERE si.signal_id = ?
           GROUP BY e.source`
        )
        .bind(signal_id)
        .all<{ source: string; cnt: number }>()

      const totalItems = sourceCounts.results.reduce((a, r) => a + r.cnt, 0)
      const sourceWeightAvg =
        totalItems === 0
          ? 1.0
          : sourceCounts.results.reduce((a, r) => a + (weights[r.source] ?? 1) * r.cnt, 0) / totalItems

      const [breakdown, signalRow] = await Promise.all([
        this.env.DB
          .prepare("SELECT urgency, recency, sentiment_delta FROM score_breakdowns WHERE signal_id=?")
          .bind(signal_id)
          .first<{ urgency: number; recency: number; sentiment_delta: number }>(),
        this.env.DB
          .prepare("SELECT theme FROM signals WHERE id=?")
          .bind(signal_id)
          .first<{ theme: string }>(),
      ])
      if (!breakdown || !signalRow) return

      const themeBoost = themeBoostList.includes(signalRow.theme) ? 1.5 : 1.0
      const newScore = totalItems * breakdown.urgency * sourceWeightAvg * themeBoost * breakdown.recency

      await this.env.DB
        .prepare(
          `UPDATE score_breakdowns
           SET volume=?, source_weight_avg=?, theme_boost=?, score=?, computed_at=datetime('now')
           WHERE signal_id=?`
        )
        .bind(totalItems, sourceWeightAvg, themeBoost, newScore, signal_id)
        .run()

      // Re-rank brief_signals for the latest brief
      const latestBrief = await this.env.DB
        .prepare("SELECT id FROM briefs ORDER BY created_at DESC LIMIT 1")
        .first<{ id: string }>()
      if (!latestBrief) return

      const signalScores = await this.env.DB
        .prepare(
          `SELECT bs.signal_id, sb.score
           FROM brief_signals bs
           JOIN score_breakdowns sb ON sb.signal_id = bs.signal_id
           JOIN signals s ON s.id = bs.signal_id
           WHERE bs.brief_id = ? AND s.is_dismissed = 0
           ORDER BY sb.score DESC`
        )
        .bind(latestBrief.id)
        .all<{ signal_id: string; score: number }>()

      await Promise.all(
        signalScores.results.map((row, i) =>
          this.env.DB
            .prepare("UPDATE brief_signals SET rank=? WHERE brief_id=? AND signal_id=?")
            .bind(i + 1, latestBrief.id, row.signal_id)
            .run()
        )
      )
    })
  }
}
