import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, description, status, devUrgency } = body

    await queryD1(
      `UPDATE roadmap_items
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           dev_urgency = COALESCE(?, dev_urgency),
           updated_at = datetime('now')
       WHERE id = ?`,
      [title ?? null, description ?? null, status ?? null, devUrgency ?? null, id]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("PUT /api/roadmap/[id] error:", err)
    return NextResponse.json({ error: "Failed to update roadmap item" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // If linked to a signal, un-mark it
    const [item] = await queryD1<{ signal_id: string | null }>(
      "SELECT signal_id FROM roadmap_items WHERE id = ?", [id]
    )
    if (item?.signal_id) {
      await queryD1(
        "UPDATE signals SET on_roadmap = 0, updated_at = datetime('now') WHERE id = ?",
        [item.signal_id]
      )
    }
    await queryD1("DELETE FROM roadmap_items WHERE id = ?", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/roadmap/[id] error:", err)
    return NextResponse.json({ error: "Failed to delete roadmap item" }, { status: 500 })
  }
}
