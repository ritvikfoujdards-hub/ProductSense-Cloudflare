import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import { kvDelete } from "@/lib/kv"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await queryD1(
      "UPDATE signals SET is_dismissed = 1, updated_at = datetime('now') WHERE id = ?",
      [id]
    )
    // Dismissed signal must not appear in cached brief
    await kvDelete("brief:latest")
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("POST /api/signals/[id]/dismiss error:", err)
    return NextResponse.json({ error: "Failed to dismiss signal" }, { status: 500 })
  }
}
