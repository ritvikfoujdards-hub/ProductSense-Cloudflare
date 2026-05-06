import { Workflow } from "cloudflare:workers"
import { EnrichmentWorkflow } from "./workflow"

// Re-export the workflow class so wrangler can find it by class_name
export { EnrichmentWorkflow }

interface Env {
  DB: D1Database
  AI: Ai
  VECTORIZE: VectorizeIndex
  ENRICHMENT_WORKFLOW: Workflow
}

interface IngestPayload {
  source: string
  text: string
  author: string
  customer_tier: string
  url?: string
}

const VALID_SOURCES = new Set(["discord", "github", "support", "twitter", "forum"])
const VALID_TIERS   = new Set(["Free", "Pro", "Business", "Enterprise"])

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json(
        { status: "ok", service: "productsense-ingest" },
        { headers: CORS_HEADERS }
      )
    }

    // ── Backfill: embed all enrichment rows that have no vector_id ────────────
    // One-time operation. Batch-embeds up to 100 items per call.
    if (url.pathname === "/backfill" && request.method === "POST") {
      const rows = await env.DB
        .prepare(
          `SELECT id, raw_text, snippet, source, customer_tier, sentiment, ingested_at
           FROM enrichment WHERE vector_id IS NULL LIMIT 100`
        )
        .all<{
          id: string; raw_text: string | null; snippet: string
          source: string; customer_tier: string; sentiment: string; ingested_at: string
        }>()

      if (!rows.results.length) {
        return Response.json({ message: "Nothing to backfill", processed: 0 }, { headers: CORS_HEADERS })
      }

      const texts = rows.results.map((r) => r.raw_text ?? r.snippet)

      // Batch embed — bge-small-en-v1.5 accepts an array of texts
      const embeddingResponse = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: texts })
      const vectors = (embeddingResponse as { data: number[][] }).data

      // Upsert all vectors to Vectorize
      await env.VECTORIZE.upsert(
        rows.results.map((row, i) => ({
          id: row.id,
          values: vectors[i],
          metadata: {
            source: row.source,
            customer_tier: row.customer_tier,
            sentiment: row.sentiment,
            ingested_at: row.ingested_at,
          },
        }))
      )

      // Mark each row as vectorized in D1
      await Promise.all(
        rows.results.map((row) =>
          env.DB.prepare("UPDATE enrichment SET vector_id=? WHERE id=?").bind(row.id, row.id).run()
        )
      )

      return Response.json(
        { message: "Backfill complete", processed: rows.results.length },
        { headers: CORS_HEADERS }
      )
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS })
    }

    // ── Parse + validate ─────────────────────────────────────────────────────
    let body: IngestPayload
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS })
    }

    const { source, text, author, customer_tier, url: feedbackUrl } = body

    if (!source || !text || !author || !customer_tier) {
      return Response.json(
        { error: "Missing required fields: source, text, author, customer_tier" },
        { status: 400, headers: CORS_HEADERS }
      )
    }
    if (!VALID_SOURCES.has(source)) {
      return Response.json(
        { error: `Invalid source. Must be one of: ${[...VALID_SOURCES].join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      )
    }
    if (!VALID_TIERS.has(customer_tier)) {
      return Response.json(
        { error: `Invalid customer_tier. Must be one of: ${[...VALID_TIERS].join(", ")}` },
        { status: 400, headers: CORS_HEADERS }
      )
    }
    if (text.trim().length < 10) {
      return Response.json(
        { error: "text must be at least 10 characters" },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const id  = crypto.randomUUID()
    const now = new Date().toISOString()

    // ── Phase 1: Write raw row to D1 immediately ─────────────────────────────
    // Scores default to 0/neutral. The EnrichmentWorkflow updates them async.
    await env.DB.prepare(
      `INSERT INTO enrichment
         (id, source, raw_text, snippet, author, customer_tier,
          sentiment_score, urgency_score, sentiment, url, timestamp_iso, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'neutral', ?, ?, ?)`
    )
      .bind(id, source, text, text.slice(0, 280), author, customer_tier, feedbackUrl ?? null, now, now)
      .run()

    // ── Phase 2: Kick off the EnrichmentWorkflow in the background ───────────
    // Returns immediately — the workflow runs durably after this response.
    const instance = await env.ENRICHMENT_WORKFLOW.create({
      id,
      params: { id, text, source, author, customer_tier, now },
    })

    return Response.json(
      {
        id,
        workflow_id: instance.id,
        status: "queued",
        message: "Feedback written to D1. Enrichment pipeline running in background.",
      },
      { status: 201, headers: CORS_HEADERS }
    )
  },
}
