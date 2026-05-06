import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import type { DashboardMetrics } from "@/lib/data"

function rangeToHours(range: string): number {
  if (range === "14d") return 336
  if (range === "30d") return 720
  return 168 // default 7d
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get("range") ?? "7d"
    const hours = rangeToHours(range)
    const prevHours = hours * 2

    const [currentRows, previousRows, themeRows, pipelineRows] = await Promise.all([
      // Current period: avg sentiment + volume
      queryD1<{ avg_sentiment: number; volume: number }>(
        `SELECT ROUND(AVG(sentiment_score), 2) AS avg_sentiment, COUNT(*) AS volume
         FROM enrichment
         WHERE ingested_at > datetime('now', '-${hours} hours')`
      ),
      // Previous period (same window, shifted back) for delta computation
      queryD1<{ avg_sentiment: number; volume: number }>(
        `SELECT ROUND(AVG(sentiment_score), 2) AS avg_sentiment, COUNT(*) AS volume
         FROM enrichment
         WHERE ingested_at > datetime('now', '-${prevHours} hours')
           AND ingested_at <= datetime('now', '-${hours} hours')`
      ),
      // Top theme by signal count
      queryD1<{ theme: string; cnt: number }>(
        `SELECT theme, COUNT(*) AS cnt FROM signals
         WHERE is_dismissed = 0
         GROUP BY theme ORDER BY cnt DESC LIMIT 1`
      ),
      // Last ingestion timestamp for pipeline health
      queryD1<{ last_ingested: string }>(
        "SELECT MAX(ingested_at) AS last_ingested FROM enrichment"
      ),
    ])

    const currentSentiment = currentRows[0]?.avg_sentiment ?? 0
    const currentVolume = currentRows[0]?.volume ?? 0
    const prevSentiment = previousRows[0]?.avg_sentiment ?? currentSentiment
    const prevVolume = previousRows[0]?.volume ?? currentVolume

    // Sentiment change as percentage points (e.g. -0.34 → -0.20 = +14pp)
    const sentimentChange =
      prevSentiment === 0
        ? 0
        : Math.round(((currentSentiment - prevSentiment) / Math.abs(prevSentiment)) * 100)

    // Volume change as percentage
    const volumeChange =
      prevVolume === 0
        ? 0
        : Math.round(((currentVolume - prevVolume) / prevVolume) * 100)

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

    const metrics: DashboardMetrics = {
      sentimentScore: currentSentiment,
      sentimentChange,
      feedbackVolume24h: currentVolume,
      volumeChange,
      topTheme: themeRows[0]?.theme ?? "—",
      themeCount: themeRows[0]?.cnt ?? 0,
      pipelineStatus,
      lastProcessed,
    }

    return NextResponse.json(metrics)
  } catch (err) {
    console.error("GET /api/metrics error:", err)
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
  }
}
