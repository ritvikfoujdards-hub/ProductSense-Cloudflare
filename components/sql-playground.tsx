"use client"

import { useState } from "react"
import { Play, Download, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const defaultQuery = `SELECT * FROM enrichment
WHERE sentiment_score < -0.5
ORDER BY urgency_score DESC
LIMIT 50;`

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    discord: "bg-[#5865F2]/10 text-[#5865F2]",
    github: "bg-[#24292F]/10 text-[#24292F]",
    support: "bg-[#F38020]/10 text-[#F38020]",
    twitter: "bg-[#1DA1F2]/10 text-[#1DA1F2]",
    forum: "bg-[#16A34A]/10 text-[#16A34A]",
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[source] ?? "bg-muted text-muted-foreground"}`}>
      {source}
    </span>
  )
}

function CellValue({ col, value }: { col: string; value: unknown }) {
  const str = value === null || value === undefined ? "NULL" : String(value)
  const num = typeof value === "number" ? value : parseFloat(str)

  if (col === "source") return <SourceBadge source={str} />

  if (col === "customer_tier") {
    const colors: Record<string, string> = {
      Enterprise: "bg-[#F38020] text-white",
      Business: "bg-[#0051AD] text-white",
      Pro: "bg-[#0051AD]/70 text-white",
      Free: "bg-muted text-muted-foreground",
    }
    return (
      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[str] ?? "bg-muted text-muted-foreground"}`}>
        {str}
      </span>
    )
  }

  if (col === "sentiment_score" && !isNaN(num)) {
    return (
      <span className={`font-mono text-xs ${num < -0.7 ? "text-[#DC2626]" : num < 0 ? "text-[#F38020]" : "text-[#16A34A]"}`}>
        {num.toFixed(2)}
      </span>
    )
  }

  if (col === "urgency_score" && !isNaN(num)) {
    return (
      <span className={`font-mono text-xs ${num >= 0.8 ? "text-[#DC2626]" : "text-foreground"}`}>
        {num.toFixed(2)}
      </span>
    )
  }

  return <span className="text-xs text-foreground truncate max-w-xs block">{str}</span>
}

export function SQLPlayground() {
  const [query, setQuery] = useState(defaultQuery)
  const [isRunning, setIsRunning] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleRunQuery = async () => {
    setIsRunning(true)
    setHasResults(false)
    setError(null)
    const start = Date.now()
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: query }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        toast.error("Query error", { description: data.error })
        return
      }
      setResults(data.results)
      setColumns(data.columns)
      setRowCount(data.rowCount)
      setHasResults(true)
      const ms = Date.now() - start
      toast.success(`${data.rowCount} rows · ${ms}ms`, { description: "Query executed against D1" })
    } catch {
      const msg = "Network error — check console"
      setError(msg)
      toast.error("Query failed")
    } finally {
      setIsRunning(false)
    }
  }

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(query)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Query copied to clipboard")
  }

  const handleExportCSV = () => {
    if (!results.length) return
    const header = columns.join(",")
    const rows = results.map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "d1-query-results.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">D1 Explorer</h2>
          <p className="text-sm text-muted-foreground">
            Query the enrichment database directly using SQL.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
            Connected to d1://productsense_db
          </span>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="rounded-lg border border-border bg-[#1a1a2e] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#2a2a3e] px-4 py-2">
          <span className="font-mono text-xs text-[#71717A]">query.sql</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-[#71717A] hover:text-white hover:bg-[#2a2a3e]"
              onClick={handleCopyQuery}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs bg-[#F38020] hover:bg-[#e0741b] text-white"
              onClick={handleRunQuery}
              disabled={isRunning}
            >
              <Play className={`h-3.5 w-3.5 ${isRunning ? "animate-pulse" : ""}`} />
              {isRunning ? "Running..." : "Run Query"}
            </Button>
          </div>
        </div>

        <div className="p-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-32 bg-transparent font-mono text-sm text-[#E4E4E7] resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-[#DC2626]/30 bg-[#FEE2E2]/50 px-4 py-3">
          <p className="font-mono text-xs text-[#DC2626]">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {hasResults && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">
              {rowCount} row{rowCount !== 1 ? "s" : ""} returned
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2 max-w-xs">
                        <CellValue col={col} value={row[col]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasResults && !error && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">Run a query to see results here</p>
        </div>
      )}
    </div>
  )
}
