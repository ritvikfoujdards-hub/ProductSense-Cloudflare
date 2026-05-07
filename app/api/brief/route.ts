import { NextResponse } from "next/server"
import { queryD1, mapRowToFeedbackItem } from "@/lib/d1"
import { kvGet, kvPut } from "@/lib/kv"
import type { Brief, Signal, ScoreBreakdown } from "@/lib/data"

const BRIEF_CACHE_KEY = "brief:latest"
const BRIEF_TTL_SECONDS = 300 // 5 minutes

type BriefRow = { id: string; headline: string; summary: string; generated_at: string }
type SignalRow = {
  id: string; product: string; theme: string; criticality: string; trend: string
  evidence: string; previous_sentiment: number; current_sentiment: number
  pull_quote: string; suggested_action: string; item_count: number; enterprise_count: number
  volume: number; urgency: number; source_weight_avg: number; theme_boost: number
  recency: number; sentiment_delta: number; score: number; rank: number; on_roadmap: number
}

export async function assembleBrief(): Promise<Brief | null> {
  const briefs = await queryD1<BriefRow>(
    "SELECT id, headline, summary, generated_at FROM briefs ORDER BY created_at DESC LIMIT 1"
  )
  if (!briefs.length) return null
  const brief = briefs[0]

  const signalRows = await queryD1<SignalRow>(
    `SELECT s.id, s.product, s.theme, s.criticality, s.trend, s.evidence,
            s.previous_sentiment, s.current_sentiment, s.pull_quote, s.suggested_action,
            s.item_count, s.enterprise_count, s.on_roadmap,
            sb.volume, sb.urgency, sb.source_weight_avg, sb.theme_boost,
            sb.recency, sb.sentiment_delta, sb.score, bs.rank
     FROM brief_signals bs
     JOIN signals s ON s.id = bs.signal_id
     JOIN score_breakdowns sb ON sb.signal_id = s.id
     WHERE bs.brief_id = ? AND s.is_dismissed = 0
     ORDER BY bs.rank ASC`,
    [brief.id]
  )

  const signals: Signal[] = await Promise.all(
    signalRows.map(async (row, index) => {
      const itemRows = await queryD1(
        `SELECT e.id, e.source, e.snippet, e.author, e.customer_tier,
                e.timestamp_iso AS timestamp, e.sentiment, e.url
         FROM signal_items si
         JOIN enrichment e ON e.id = si.item_id
         WHERE si.signal_id = ?`,
        [row.id]
      )

      const scoreBreakdown: ScoreBreakdown = {
        volume: row.volume,
        urgency: row.urgency,
        sourceWeightAvg: row.source_weight_avg,
        themeBoost: row.theme_boost,
        recency: row.recency,
        sentimentDelta: row.sentiment_delta,
        score: row.score,
      }

      return {
        id: row.id,
        number: index + 1,
        trend: row.trend as Signal["trend"],
        criticality: row.criticality as Signal["criticality"],
        product: row.product,
        theme: row.theme,
        evidence: row.evidence,
        previousSentiment: row.previous_sentiment,
        currentSentiment: row.current_sentiment,
        pullQuote: row.pull_quote,
        suggestedAction: row.suggested_action,
        itemCount: row.item_count,
        enterpriseCount: row.enterprise_count,
        onRoadmap: row.on_roadmap === 1,
        scoreBreakdown,
        items: itemRows.map(mapRowToFeedbackItem as (r: Record<string, unknown>) => ReturnType<typeof mapRowToFeedbackItem>),
      }
    })
  )

  return {
    headline: brief.headline,
    summary: brief.summary,
    generatedAt: brief.generated_at,
    signals,
  }
}

export async function GET() {
  try {
    // Cache hit — return KV value immediately, skip all D1 queries
    const cached = await kvGet<Brief>(BRIEF_CACHE_KEY)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      })
    }

    // Cache miss — query D1, write to KV, return result
    const brief = await assembleBrief()
    if (!brief) return NextResponse.json({ error: "No brief found" }, { status: 404 })

    await kvPut(BRIEF_CACHE_KEY, brief, BRIEF_TTL_SECONDS)

    return NextResponse.json(brief, {
      headers: { "X-Cache": "MISS" },
    })
  } catch (err) {
    console.error("GET /api/brief error:", err)
    return NextResponse.json({ error: "Failed to fetch brief" }, { status: 500 })
  }
}
