import { NextResponse } from "next/server"
import { queryD1 } from "@/lib/d1"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const sql: string = body.sql ?? ""

    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return NextResponse.json({ error: "Only SELECT queries are allowed" }, { status: 400 })
    }

    const results = await queryD1(sql)
    const columns = results.length > 0 ? Object.keys(results[0]) : []

    return NextResponse.json({ results, columns, rowCount: results.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed"
    console.error("POST /api/query error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
