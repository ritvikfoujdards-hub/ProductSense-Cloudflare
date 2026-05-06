import type { FeedbackItem, Source, Weights } from "./data"

declare global {
  interface CloudflareEnv {
    DB: D1Database
  }
}

async function queryD1Native<T>(sql: string, params: unknown[]): Promise<T[]> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = getCloudflareContext()
  const db = env.DB
  const stmt = params.length > 0 ? db.prepare(sql).bind(...params) : db.prepare(sql)
  const result = await stmt.all<T>()
  return result.results ?? []
}

async function queryD1REST<T>(sql: string, params: unknown[]): Promise<T[]> {
  const BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.errors?.[0]?.message ?? "D1 query failed")
  return (json.result[0]?.results ?? []) as T[]
}

export async function queryD1<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    return await queryD1Native<T>(sql, params)
  } catch {
    return queryD1REST<T>(sql, params)
  }
}

type EnrichmentRow = {
  id: string
  source: string
  snippet: string
  author: string
  customer_tier: string
  timestamp: string
  sentiment: string
  url?: string
}

export function mapRowToFeedbackItem(row: EnrichmentRow): FeedbackItem {
  return {
    id: row.id,
    source: row.source as Source,
    snippet: row.snippet,
    author: row.author,
    customerTier: row.customer_tier as FeedbackItem["customerTier"],
    timestamp: row.timestamp ?? "",
    sentiment: row.sentiment as FeedbackItem["sentiment"],
    url: row.url,
  }
}

type PolicyRow = {
  source_weights: string
  theme_boosts: string
  recency_half_life: number
  sentiment_threshold: number
}

export function mapRowToWeights(row: PolicyRow): Weights {
  return {
    sources: JSON.parse(row.source_weights),
    themeBoosts: JSON.parse(row.theme_boosts),
    recencyHalfLife: row.recency_half_life,
    sentimentThreshold: row.sentiment_threshold,
  }
}
