import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"
import type { RoadmapItem } from "@/lib/data"

type RoadmapRow = {
  id: string; title: string; description: string; signal_id: string | null
  status: string; pm_priority: string; dev_urgency: string
  upvotes: number; downvotes: number; created_at: string; updated_at: string
}

function mapRow(r: RoadmapRow): RoadmapItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    signalId: r.signal_id,
    status: r.status as RoadmapItem["status"],
    pmPriority: r.pm_priority as RoadmapItem["pmPriority"],
    devUrgency: r.dev_urgency as RoadmapItem["devUrgency"],
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function GET() {
  try {
    const rows = await queryD1<RoadmapRow>(
      `SELECT * FROM roadmap_items
       ORDER BY
         CASE dev_urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         (upvotes - downvotes) DESC,
         created_at DESC`
    )
    return NextResponse.json(rows.map(mapRow))
  } catch (err) {
    console.error("GET /api/roadmap error:", err)
    return NextResponse.json({ error: "Failed to fetch roadmap" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, description = "", pmPriority = "medium", devUrgency = "medium" } = body
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    const id = `ri-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await queryD1(
      `INSERT INTO roadmap_items (id, title, description, pm_priority, dev_urgency)
       VALUES (?, ?, ?, ?, ?)`,
      [id, title.trim(), description.trim(), pmPriority, devUrgency]
    )
    const [row] = await queryD1<RoadmapRow>("SELECT * FROM roadmap_items WHERE id = ?", [id])
    return NextResponse.json(mapRow(row), { status: 201 })
  } catch (err) {
    console.error("POST /api/roadmap error:", err)
    return NextResponse.json({ error: "Failed to create roadmap item" }, { status: 500 })
  }
}
