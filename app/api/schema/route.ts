import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"

export async function GET() {
  try {
    const tables = await queryD1<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name"
    )
    const schema: Record<string, string[]> = {}
    await Promise.all(
      tables.map(async ({ name }) => {
        const cols = await queryD1<{ name: string }>(`PRAGMA table_info(${name})`)
        schema[name] = cols.map((c) => c.name)
      })
    )
    return NextResponse.json(schema)
  } catch (err) {
    console.error("GET /api/schema error:", err)
    return NextResponse.json({ error: "Failed to fetch schema" }, { status: 500 })
  }
}
