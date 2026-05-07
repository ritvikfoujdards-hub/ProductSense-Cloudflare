import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"

// direction: "up" | "down" | null (null = remove vote)
// previous:  "up" | "down" | null (what the client had before)
// Server computes the delta atomically so concurrent votes don't conflict.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { direction, previous } = await req.json() as {
      direction: "up" | "down" | null
      previous:  "up" | "down" | null
    }

    const deltaUp   = (direction === "up"   ? 1 : 0) - (previous === "up"   ? 1 : 0)
    const deltaDown = (direction === "down" ? 1 : 0) - (previous === "down" ? 1 : 0)

    await queryD1(
      `UPDATE roadmap_items
       SET upvotes   = MAX(0, upvotes   + ?),
           downvotes = MAX(0, downvotes + ?),
           updated_at = datetime('now')
       WHERE id = ?`,
      [deltaUp, deltaDown, id]
    )

    const [row] = await queryD1<{ upvotes: number; downvotes: number }>(
      "SELECT upvotes, downvotes FROM roadmap_items WHERE id = ?", [id]
    )
    return NextResponse.json({ upvotes: row.upvotes, downvotes: row.downvotes })
  } catch (err) {
    console.error("POST /api/roadmap/[id]/vote error:", err)
    return NextResponse.json({ error: "Failed to record vote" }, { status: 500 })
  }
}
