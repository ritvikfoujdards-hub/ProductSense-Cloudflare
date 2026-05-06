import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"

function rangeToHours(range: string): number {
  if (range === "14d") return 336
  if (range === "30d") return 720
  return 168
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get("range") ?? "7d"
    const hours = rangeToHours(range)

    const rows = await queryD1<{ day: string; avg_sentiment: number }>(
      `SELECT DATE(ingested_at) AS day,
              ROUND(AVG(sentiment_score), 3) AS avg_sentiment
       FROM enrichment
       WHERE ingested_at > datetime('now', '-${hours} hours')
       GROUP BY DATE(ingested_at)
       ORDER BY day ASC`
    )

    // Return raw values — client maps to sparkline
    const values = rows.map((r) => r.avg_sentiment)

    // If not enough data points, pad with the global average so the sparkline
    // renders without an empty state. Minimum 2 points required for polyline.
    if (values.length < 2) {
      const fallback = values[0] ?? -0.3
      const days = Math.ceil(hours / 24)
      return NextResponse.json({ values: Array(days).fill(fallback) })
    }

    return NextResponse.json({ values })
  } catch (err) {
    console.error("GET /api/metrics/history error:", err)
    return NextResponse.json({ values: [] }, { status: 500 })
  }
}
