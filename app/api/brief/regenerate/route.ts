import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import { kvDelete, kvPut } from "@/lib/kv"
import { assembleBrief } from "../route"

const BRIEF_CACHE_KEY = "brief:latest"
const BRIEF_TTL_SECONDS = 300

export async function POST() {
  try {
    const briefs = await queryD1<{ id: string }>(
      "SELECT id FROM briefs ORDER BY created_at DESC LIMIT 1"
    )
    if (!briefs.length) return NextResponse.json({ error: "No brief found" }, { status: 404 })
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

    // Invalidate stale cache then write fresh value
    await kvDelete(BRIEF_CACHE_KEY)
    const brief = await assembleBrief()
    if (brief) await kvPut(BRIEF_CACHE_KEY, brief, BRIEF_TTL_SECONDS)

    return NextResponse.json(brief)
  } catch (err) {
    console.error("POST /api/brief/regenerate error:", err)
    return NextResponse.json({ error: "Failed to regenerate brief" }, { status: 500 })
  }
}
