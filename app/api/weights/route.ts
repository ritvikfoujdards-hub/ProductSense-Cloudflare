import { NextResponse } from "next/server"
import { queryD1, mapRowToWeights } from "@/lib/d1"
import { kvDelete, kvPut } from "@/lib/kv"
import { assembleBrief } from "../brief/route"
import type { Weights } from "@/lib/data"

const BRIEF_CACHE_KEY = "brief:latest"
const BRIEF_TTL_SECONDS = 300

export async function GET() {
  try {
    const rows = await queryD1(
      `SELECT source_weights, theme_boosts, recency_half_life, sentiment_threshold
       FROM weighting_policies WHERE is_active = 1 LIMIT 1`
    )
    if (!rows.length) return NextResponse.json({ error: "No active policy" }, { status: 404 })
    return NextResponse.json(mapRowToWeights(rows[0] as Parameters<typeof mapRowToWeights>[0]))
  } catch (err) {
    console.error("GET /api/weights error:", err)
    return NextResponse.json({ error: "Failed to fetch weights" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const weights: Weights = await req.json()
    const newId = `policy-${Date.now()}`

    // Deactivate all existing policies
    await queryD1("UPDATE weighting_policies SET is_active = 0")

    // Insert new active policy
    await queryD1(
      `INSERT INTO weighting_policies
         (id, name, source_weights, theme_boosts, recency_half_life, sentiment_threshold, is_active)
       VALUES (?, 'Custom', ?, ?, ?, ?, 1)`,
      [
        newId,
        JSON.stringify(weights.sources),
        JSON.stringify(weights.themeBoosts),
        weights.recencyHalfLife,
        weights.sentimentThreshold,
      ]
    )

    // Fetch all non-dismissed signals
    const signals = await queryD1<{ id: string; theme: string }>(
      "SELECT id, theme FROM signals WHERE is_dismissed = 0"
    )

    // Recompute score for each signal
    await Promise.all(
      signals.map(async (signal) => {
        const sourceCounts = await queryD1<{ source: string; cnt: number }>(
          `SELECT e.source, COUNT(*) AS cnt
           FROM signal_items si JOIN enrichment e ON e.id = si.item_id
           WHERE si.signal_id = ? GROUP BY e.source`,
          [signal.id]
        )

        const totalItems = sourceCounts.reduce((s, r) => s + r.cnt, 0)
        const sourceWeightAvg =
          totalItems === 0
            ? 1.0
            : sourceCounts.reduce((s, r) => {
                const w = (weights.sources as Record<string, number>)[r.source] ?? 1.0
                return s + w * r.cnt
              }, 0) / totalItems

        const themeBoost = weights.themeBoosts.includes(signal.theme) ? 1.5 : 1.0

        // Get current score components
        const [breakdown] = await queryD1<{
          volume: number; urgency: number; recency: number; sentiment_delta: number
        }>(
          "SELECT volume, urgency, recency, sentiment_delta FROM score_breakdowns WHERE signal_id = ?",
          [signal.id]
        )
        if (!breakdown) return

        const newScore =
          breakdown.volume *
          breakdown.urgency *
          sourceWeightAvg *
          themeBoost *
          breakdown.recency

        await queryD1(
          `UPDATE score_breakdowns
           SET source_weight_avg = ?, theme_boost = ?, score = ?, computed_at = datetime('now')
           WHERE signal_id = ?`,
          [sourceWeightAvg, themeBoost, newScore, signal.id]
        )
      })
    )

    // Re-rank brief_signals
    const briefs = await queryD1<{ id: string }>(
      "SELECT id FROM briefs ORDER BY created_at DESC LIMIT 1"
    )
    if (briefs.length) {
      const briefId = briefs[0].id
      const signalScores = await queryD1<{ signal_id: string; score: number }>(
        `SELECT bs.signal_id, sb.score
         FROM brief_signals bs
         JOIN score_breakdowns sb ON sb.signal_id = bs.signal_id
         JOIN signals s ON s.id = bs.signal_id
         WHERE bs.brief_id = ? AND s.is_dismissed = 0
         ORDER BY sb.score DESC`,
        [briefId]
      )
      await Promise.all(
        signalScores.map((row, index) =>
          queryD1(
            "UPDATE brief_signals SET rank = ? WHERE brief_id = ? AND signal_id = ?",
            [index + 1, briefId, row.signal_id]
          )
        )
      )
    }

    // Invalidate stale cache then write recomputed brief
    await kvDelete(BRIEF_CACHE_KEY)
    const brief = await assembleBrief()
    if (brief) await kvPut(BRIEF_CACHE_KEY, brief, BRIEF_TTL_SECONDS)

    return NextResponse.json({ brief })
  } catch (err) {
    console.error("POST /api/weights error:", err)
    return NextResponse.json({ error: "Failed to apply weights" }, { status: 500 })
  }
}
