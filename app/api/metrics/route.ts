import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import type { DashboardMetrics } from "@/lib/data"

function rangeToHours(range: string): number {
  if (range === "14d") return 336
  if (range === "30d") return 720
  return 168 // default 7d
}

type SourceRow = { source: string; avg_sentiment: number; cnt: number }

function computeWeightedMetrics(
  rows: SourceRow[],
  sourceWeights: Record<string, number>
): { sentiment: number; volume: number } {
  let sentSum = 0
  let volSum = 0
  for (const row of rows) {
    const w = sourceWeights[row.source] ?? 1.0
    sentSum += row.avg_sentiment * w * row.cnt
    volSum  += w * row.cnt
  }
  return {
    sentiment: volSum > 0 ? Math.round((sentSum / volSum) * 100) / 100 : 0,
    volume:    Math.round(volSum),
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get("range") ?? "7d"
    const hours = rangeToHours(range)
    const prevHours = hours * 2

    const [policyRows, currentRows, previousRows, themeRows, pipelineRows] = await Promise.all([
      // Active weighting policy — drives weighted sentiment + volume
      queryD1<{ source_weights: string }>(
        "SELECT source_weights FROM weighting_policies WHERE is_active = 1 LIMIT 1"
      ),
      // Current period: per-source avg sentiment + count
      queryD1<SourceRow>(
        `SELECT source,
                ROUND(AVG(sentiment_score), 3) AS avg_sentiment,
                COUNT(*) AS cnt
         FROM enrichment
         WHERE ingested_at > datetime('now', '-${hours} hours')
         GROUP BY source`
      ),
      // Previous period (same window shifted back) for delta
      queryD1<SourceRow>(
        `SELECT source,
                ROUND(AVG(sentiment_score), 3) AS avg_sentiment,
                COUNT(*) AS cnt
         FROM enrichment
         WHERE ingested_at > datetime('now', '-${prevHours} hours')
           AND ingested_at <= datetime('now', '-${hours} hours')
         GROUP BY source`
      ),
      // Top theme = theme of the highest-scored non-dismissed signal
      queryD1<{ theme: string; cnt: number }>(
        `SELECT s.theme AS theme,
                (SELECT COUNT(*) FROM signals WHERE theme = s.theme AND is_dismissed = 0) AS cnt
         FROM score_breakdowns sb
         JOIN signals s ON s.id = sb.signal_id
         WHERE s.is_dismissed = 0
         ORDER BY sb.score DESC
         LIMIT 1`
      ),
      // Last ingestion time for pipeline health
      queryD1<{ last_ingested: string }>(
        "SELECT MAX(ingested_at) AS last_ingested FROM enrichment"
      ),
    ])

    const sourceWeights: Record<string, number> = policyRows[0]
      ? JSON.parse(policyRows[0].source_weights)
      : {}

    const current  = computeWeightedMetrics(currentRows,  sourceWeights)
    const previous = computeWeightedMetrics(previousRows, sourceWeights)

    const sentimentChange =
      previous.sentiment === 0
        ? 0
        : Math.round(((current.sentiment - previous.sentiment) / Math.abs(previous.sentiment)) * 100)

    const volumeChange =
      previous.volume === 0
        ? 0
        : Math.round(((current.volume - previous.volume) / previous.volume) * 100)

    const lastIngested = pipelineRows[0]?.last_ingested
    const minutesSinceSync = lastIngested
      ? Math.round((Date.now() - new Date(lastIngested).getTime()) / 60000)
      : 9999

    const pipelineStatus: DashboardMetrics["pipelineStatus"] =
      minutesSinceSync > 1440 ? "offline" :
      minutesSinceSync > 120  ? "degraded" :
      "healthy"

    const lastProcessed =
      minutesSinceSync >= 1440 ? `${Math.round(minutesSinceSync / 1440)}d ago` :
      minutesSinceSync >= 60   ? `${Math.round(minutesSinceSync / 60)}h ago` :
      `${minutesSinceSync} min ago`

    return NextResponse.json({
      sentimentScore:    current.sentiment,
      sentimentChange,
      feedbackVolume24h: current.volume,
      volumeChange,
      topTheme:    themeRows[0]?.theme ?? "—",
      themeCount:  themeRows[0]?.cnt ?? 0,
      pipelineStatus,
      lastProcessed,
    } satisfies DashboardMetrics)
  } catch (err) {
    console.error("GET /api/metrics error:", err)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
