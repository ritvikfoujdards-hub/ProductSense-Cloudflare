"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Play, Download, Copy, Check, ChevronRight, Clock, ChevronDown, Database, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const HISTORY_KEY = "ps_query_history"
const MAX_HISTORY = 10

const PRESET_GROUPS = [
  {
    label: "Signals",
    queries: [
      { name: "All signals by score", sql: `SELECT s.id, s.product, s.theme, s.criticality, sb.score\nFROM score_breakdowns sb\nJOIN signals s ON s.id = sb.signal_id\nWHERE s.is_dismissed = 0\nORDER BY sb.score DESC;` },
      { name: "Dismissed signals", sql: `SELECT id, product, theme, updated_at\nFROM signals\nWHERE is_dismissed = 1\nORDER BY updated_at DESC;` },
      { name: "Signals on roadmap", sql: `SELECT s.id, s.product, s.theme, r.title, r.status, r.dev_urgency\nFROM signals s\nJOIN roadmap_items r ON r.signal_id = s.id\nWHERE s.on_roadmap = 1;` },
      { name: "Score breakdown detail", sql: `SELECT s.product, s.theme, sb.volume, sb.urgency,\n       sb.source_weight_avg, sb.theme_boost, sb.recency, sb.score\nFROM score_breakdowns sb\nJOIN signals s ON s.id = sb.signal_id\nORDER BY sb.score DESC;` },
    ],
  },
  {
    label: "Enrichment",
    queries: [
      { name: "Most negative items", sql: `SELECT id, source, snippet, author, customer_tier, sentiment_score\nFROM enrichment\nWHERE sentiment_score < -0.5\nORDER BY urgency_score DESC\nLIMIT 50;` },
      { name: "Volume by source", sql: `SELECT source,\n       COUNT(*) AS total,\n       ROUND(AVG(sentiment_score), 3) AS avg_sentiment,\n       ROUND(AVG(urgency_score), 3) AS avg_urgency\nFROM enrichment\nGROUP BY source\nORDER BY total DESC;` },
      { name: "Enterprise items only", sql: `SELECT id, source, snippet, author, sentiment_score, ingested_at\nFROM enrichment\nWHERE customer_tier = 'Enterprise'\nORDER BY ingested_at DESC\nLIMIT 30;` },
      { name: "Latest 20 ingestions", sql: `SELECT id, source, author, customer_tier,\n       sentiment_score, ingested_at\nFROM enrichment\nORDER BY ingested_at DESC\nLIMIT 20;` },
    ],
  },
  {
    label: "Roadmap",
    queries: [
      { name: "Items by net votes", sql: `SELECT title, status, dev_urgency, pm_priority,\n       upvotes, downvotes, (upvotes - downvotes) AS net_votes\nFROM roadmap_items\nORDER BY net_votes DESC;` },
      { name: "High-urgency items", sql: `SELECT title, status, pm_priority,\n       upvotes, downvotes, created_at\nFROM roadmap_items\nWHERE dev_urgency = 'high'\nORDER BY (upvotes - downvotes) DESC;` },
    ],
  },
  {
    label: "Pipeline",
    queries: [
      { name: "Ingestion health", sql: `SELECT source,\n       COUNT(*) AS total,\n       MAX(ingested_at) AS last_seen\nFROM enrichment\nGROUP BY source\nORDER BY last_seen DESC;` },
      { name: "Items without embeddings", sql: `SELECT id, source, snippet, ingested_at\nFROM enrichment\nWHERE vector_id IS NULL\nORDER BY ingested_at DESC\nLIMIT 20;` },
      { name: "Active weighting policy", sql: `SELECT id, name, source_weights, theme_boosts,\n       recency_half_life, sentiment_threshold, is_active\nFROM weighting_policies\nWHERE is_active = 1;` },
    ],
  },
]

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") } catch { return [] }
}

function saveToHistory(sql: string) {
  const h = loadHistory().filter((q) => q !== sql)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([sql, ...h].slice(0, MAX_HISTORY)))
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    discord: "bg-[#5865F2]/10 text-[#5865F2]",
    github: "bg-[#24292F]/10 text-[#24292F]",
    support: "bg-[#F38020]/10 text-[#F38020]",
    twitter: "bg-[#1DA1F2]/10 text-[#1DA1F2]",
    forum: "bg-[#16A34A]/10 text-[#16A34A]",
  }
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase", colors[source] ?? "bg-muted text-muted-foreground")}>
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
    return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", colors[str] ?? "bg-muted text-muted-foreground")}>{str}</span>
  }

  if ((col === "sentiment_score" || col === "avg_sentiment") && !isNaN(num)) {
    return <span className={cn("font-mono text-xs", num < -0.7 ? "text-[#DC2626]" : num < 0 ? "text-[#F38020]" : "text-[#16A34A]")}>{num.toFixed(3)}</span>
  }

  if ((col === "urgency_score" || col === "avg_urgency") && !isNaN(num)) {
    return <span className={cn("font-mono text-xs", num >= 0.8 ? "text-[#DC2626]" : "text-foreground")}>{num.toFixed(3)}</span>
  }

  if ((col === "score" || col === "net_votes") && !isNaN(num)) {
    return <span className="font-mono text-xs font-semibold text-foreground">{num.toFixed ? num.toFixed(2) : num}</span>
  }

  return <span className="text-xs text-foreground truncate max-w-xs block">{str === "NULL" ? <span className="text-muted-foreground/50 italic">NULL</span> : str}</span>
}

export function SQLPlayground() {
  const [query, setQuery] = useState(PRESET_GROUPS[1].queries[0].sql)
  const [isRunning, setIsRunning] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [schema, setSchema] = useState<Record<string, string[]>>({})
  const [schemaOpen, setSchemaOpen] = useState<Record<string, boolean>>({})
  const [history, setHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [activePresetGroup, setActivePresetGroup] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    setHistory(loadHistory())
    fetch("/api/schema").then((r) => r.json()).then(setSchema).catch(() => {})
  }, [])

  const runQuery = useCallback(async (sql: string) => {
    setIsRunning(true)
    setHasResults(false)
    setError(null)
    setShowHistory(false)
    setShowPresets(false)
    const start = Date.now()
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); toast.error("Query error", { description: data.error }); return }
      setResults(data.results)
      setColumns(data.columns)
      setRowCount(data.rowCount)
      setHasResults(true)
      setSortCol(null)
      saveToHistory(sql.trim())
      setHistory(loadHistory())
      toast.success(`${data.rowCount} rows · ${Date.now() - start}ms`, { description: "Executed against D1" })
    } catch {
      setError("Network error — check console")
      toast.error("Query failed")
    } finally {
      setIsRunning(false)
    }
  }, [])

  const sortedResults = useMemo(() => {
    if (!sortCol) return results
    return [...results].sort((a, b) => {
      const av = a[sortCol] ?? ""
      const bv = b[sortCol] ?? ""
      const an = parseFloat(String(av))
      const bn = parseFloat(String(bv))
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [results, sortCol, sortDir])

  const handleSortCol = (col: string) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  const handleRunQuery = () => runQuery(query)

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(query)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Query copied")
  }

  const handleExportCSV = () => {
    if (!results.length) return
    const header = columns.join(",")
    const rows = results.map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "d1-export.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Schema sidebar */}
      <div className="w-52 shrink-0 space-y-1 overflow-y-auto">
        <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Database className="h-3.5 w-3.5" />
          Schema
        </div>
        {Object.entries(schema).map(([table, cols]) => (
          <div key={table}>
            <button
              onClick={() => {
                setSchemaOpen((o) => ({ ...o, [table]: !o[table] }))
              }}
              onDoubleClick={() => setQuery(`SELECT * FROM ${table} LIMIT 20;`)}
              className="w-full flex items-center gap-1 rounded px-2 py-1 text-xs text-left hover:bg-muted transition-colors"
              title="Double-click to query"
            >
              <ChevronRight className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", schemaOpen[table] && "rotate-90")} />
              <span className="font-mono font-medium text-foreground truncate">{table}</span>
            </button>
            {schemaOpen[table] && (
              <div className="ml-5 space-y-0.5 mb-1">
                {cols.map((col) => (
                  <div key={col} className="text-[10px] font-mono text-muted-foreground px-1 py-0.5 truncate">
                    {col}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main editor area */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Toolbar: presets + history */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Presets dropdown */}
          <div className="relative">
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setShowPresets((v) => !v); setShowHistory(false) }}>
              Presets <ChevronDown className="h-3 w-3" />
            </Button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 z-30 rounded-md border border-border bg-card shadow-lg w-72">
                <div className="flex border-b border-border">
                  {PRESET_GROUPS.map((g, i) => (
                    <button
                      key={g.label}
                      onClick={() => setActivePresetGroup(i)}
                      className={cn("flex-1 px-2 py-1.5 text-xs transition-colors", activePresetGroup === i ? "bg-muted font-semibold" : "hover:bg-muted/50 text-muted-foreground")}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="py-1">
                  {PRESET_GROUPS[activePresetGroup].queries.map((q) => (
                    <button
                      key={q.name}
                      onClick={() => { setQuery(q.sql); setShowPresets(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                    >
                      {q.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History dropdown */}
          {history.length > 0 && (
            <div className="relative">
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setShowHistory((v) => !v); setShowPresets(false) }}>
                <Clock className="h-3 w-3" /> History
              </Button>
              {showHistory && (
                <div className="absolute top-full left-0 mt-1 z-30 rounded-md border border-border bg-card shadow-lg w-80 max-h-60 overflow-y-auto">
                  {history.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(q); setShowHistory(false) }}
                      className="w-full text-left px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors truncate"
                    >
                      {q.split("\n")[0].slice(0, 60)}…
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
            d1://productsense_db
          </div>
        </div>

        {/* SQL editor */}
        <div className="rounded-lg border border-border bg-[#1a1a2e] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#2a2a3e] px-4 py-2">
            <span className="font-mono text-xs text-[#71717A]">query.sql</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-[#71717A] hover:text-white hover:bg-[#2a2a3e]" onClick={handleCopyQuery}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" className="h-7 gap-1.5 text-xs bg-[#F38020] hover:bg-[#e0741b] text-white" onClick={handleRunQuery} disabled={isRunning}>
                <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                {isRunning ? "Running…" : "Run Query"}
              </Button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRunQuery() } }}
              className="w-full h-36 bg-transparent font-mono text-sm text-[#E4E4E7] resize-none focus:outline-none"
              spellCheck={false}
              placeholder="SELECT * FROM enrichment LIMIT 10;"
            />
          </div>
          <div className="border-t border-[#2a2a3e] px-4 py-1">
            <span className="text-[10px] text-[#71717A]">⌘↵ to run · SELECT only · double-click table in schema to query</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[#DC2626]/30 bg-[#FEE2E2]/50 px-4 py-3">
            <p className="font-mono text-xs text-[#DC2626]">{error}</p>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">
                {rowCount} row{rowCount !== 1 ? "s" : ""} returned
              </span>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors group"
                        onClick={() => handleSortCol(col)}
                      >
                        <span className="flex items-center gap-1">
                          {col}
                          {sortCol === col
                            ? sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-[#F38020]" /> : <ArrowDown className="h-3 w-3 text-[#F38020]" />
                            : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedResults.map((row, i) => (
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

        {!hasResults && !error && (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">Run a query to see results here</p>
          </div>
        )}
      </div>
    </div>
  )
}
