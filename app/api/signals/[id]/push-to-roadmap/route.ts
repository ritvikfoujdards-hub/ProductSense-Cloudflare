import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import { kvDelete } from "@/lib/kv"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { title, description, pmPriority = "medium", devUrgency = "medium" } = body

    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    // Check signal exists and isn't already on roadmap
    const [signal] = await queryD1<{ on_roadmap: number }>(
      "SELECT on_roadmap FROM signals WHERE id = ?", [id]
    )
    if (!signal) return NextResponse.json({ error: "Signal not found" }, { status: 404 })
    if (signal.on_roadmap === 1) return NextResponse.json({ error: "Already on roadmap" }, { status: 409 })

    const itemId = `ri-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await queryD1(
      `INSERT INTO roadmap_items (id, title, description, signal_id, pm_priority, dev_urgency)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [itemId, title.trim(), (description ?? "").trim(), id, pmPriority, devUrgency]
    )
    await queryD1(
      "UPDATE signals SET on_roadmap = 1, updated_at = datetime('now') WHERE id = ?",
      [id]
    )

    // Invalidate brief cache so signal card shows updated on_roadmap state
    await kvDelete("brief:latest")

    return NextResponse.json({ id: itemId, success: true }, { status: 201 })
  } catch (err) {
    console.error("POST /api/signals/[id]/push-to-roadmap error:", err)
    return NextResponse.json({ error: "Failed to push signal to roadmap" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [item] = await queryD1<{ id: string }>(
      "SELECT id FROM roadmap_items WHERE signal_id = ?", [id]
    )
    if (!item) return NextResponse.json({ error: "No roadmap item linked to this signal" }, { status: 404 })

    await queryD1("DELETE FROM roadmap_items WHERE id = ?", [item.id])
    await queryD1("UPDATE signals SET on_roadmap = 0, updated_at = datetime('now') WHERE id = ?", [id])
    await kvDelete("brief:latest")

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/signals/[id]/push-to-roadmap error:", err)
    return NextResponse.json({ error: "Failed to remove from roadmap" }, { status: 500 })
  }
}
