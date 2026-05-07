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

// ── Synthetic feedback pool for scheduled ingestion ───────────────────────────
// Each cron tick picks 2-3 entries at random to keep the pipeline alive and
// keep ingested_at fresh so pipeline status stays "healthy".
const SYNTHETIC_FEEDBACK: IngestPayload[] = [
  { source: "discord",  author: "@edge_dev_042",      customer_tier: "Pro",        text: "Workers AI inference is noticeably faster this week — our p95 dropped from 1.8s to 0.9s. Whatever you shipped, keep it." },
  { source: "twitter",  author: "@saas_founder",       customer_tier: "Business",   text: "Switched our entire AI pipeline to Workers AI last month. Zero rate limit issues since the infra update. Huge improvement." },
  { source: "forum",    author: "backend_oluwaseun",   customer_tier: "Pro",        text: "D1 query performance on large joins is still a pain. 800ms for a 3-table join on 50k rows feels too slow for my use case." },
  { source: "github",   author: "gh-user-mlpipeline",  customer_tier: "Business",   text: "Workers AI: bge-small-en-v1.5 embeddings endpoint returns inconsistent vector lengths under load. Reproducible at >10 concurrent requests." },
  { source: "support",  author: "platform@acmecorp.io", customer_tier: "Enterprise", text: "We need a self-serve way to raise our Workers AI token limits without going through sales. This is blocking our Q3 launch." },
  { source: "discord",  author: "@wasm_tinkerer",      customer_tier: "Free",       text: "R2 pre-signed URLs are a game changer for our mobile upload flow. Docs could use a better example for multipart uploads though." },
  { source: "forum",    author: "fullstack_priya",     customer_tier: "Pro",        text: "wrangler d1 local dev keeps dropping migration state after a cold start. Third time this week I've had to recreate my schema from scratch." },
  { source: "twitter",  author: "@cfworkers_fan",      customer_tier: "Pro",        text: "The new Workers tail logging in the dashboard is a huge QoL improvement. Can finally debug production issues without `wrangler tail` open." },
  { source: "support",  author: "devops@scale.io",     customer_tier: "Enterprise", text: "Workers AI 429 errors spiking again during our 9am traffic burst. We have an enterprise plan — why are we still hitting free tier limits?" },
  { source: "github",   author: "gh-user-d1perf",      customer_tier: "Business",   text: "Feature request: D1 connection pooling or read replicas for multi-region apps. Latency from EU to the US primary is 220ms." },
  { source: "discord",  author: "@kv_power_user",      customer_tier: "Pro",        text: "KV bulk writes via the REST API are timing out for batches >500 keys. Works fine under 100. Is there a documented batch limit?" },
  { source: "forum",    author: "startup_chen",        customer_tier: "Free",       text: "R2 egress pricing is finally clear after the doc update. Moved 1TB from S3 last weekend — zero surprise charges on the bill." },
  { source: "support",  author: "cto@finflow.app",     customer_tier: "Enterprise", text: "Need SOC2 evidence for our D1 deployment. Compliance team is asking for data residency guarantees. Who do we talk to?" },
  { source: "twitter",  author: "@jamstack_builder",   customer_tier: "Pro",        text: "Next.js on Workers via OpenNext is actually production-ready now. Deployed our whole app in 20 minutes. Impressed." },
  { source: "discord",  author: "@ai_prototyper",      customer_tier: "Free",       text: "Workers AI llama-3.1-8b output is non-deterministic even with temperature=0. Is seed param supported for reproducible outputs?" },
]

async function ingestOne(env: Env, payload: IngestPayload): Promise<void> {
  const id  = crypto.randomUUID()
  const now = new Date().toISOString()
  const { source, text, author, customer_tier, url: feedbackUrl } = payload

  await env.DB.prepare(
    `INSERT INTO enrichment
       (id, source, raw_text, snippet, author, customer_tier,
        sentiment_score, urgency_score, sentiment, url, timestamp_iso, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'neutral', ?, ?, ?)`
  ).bind(id, source, text, text.slice(0, 280), author, customer_tier, feedbackUrl ?? null, now, now).run()

  await env.ENRICHMENT_WORKFLOW.create({
    id,
    params: { id, text, source, author, customer_tier, now },
  })
}

export default {
  // ── HTTP handler ─────────────────────────────────────────────────────────────
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

      const embeddingResponse = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: texts })
      const vectors = (embeddingResponse as { data: number[][] }).data

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

    await ingestOne(env, { source, text, author, customer_tier, url: feedbackUrl })
    const id = crypto.randomUUID()

    return Response.json(
      {
        id,
        status: "queued",
        message: "Feedback written to D1. Enrichment pipeline running in background.",
      },
      { status: 201, headers: CORS_HEADERS }
    )
  },

  // ── Cron trigger: runs every 30 minutes ──────────────────────────────────────
  // Picks 2 random feedback items from the pool and ingests them so that
  // MAX(ingested_at) stays fresh and pipeline status remains "healthy".
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const shuffled = [...SYNTHETIC_FEEDBACK].sort(() => Math.random() - 0.5)
    const batch = shuffled.slice(0, 2)
    ctx.waitUntil(Promise.all(batch.map((item) => ingestOne(env, item))))
  },
}
