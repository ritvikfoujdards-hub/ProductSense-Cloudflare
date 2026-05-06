"use client"

import { useState } from "react"
import { Play, Download, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const defaultQuery = `SELECT * FROM enrichment 
WHERE sentiment_score < -0.5 
ORDER BY urgency_score DESC 
LIMIT 50;`

// Mock query results
const mockResults = [
  {
    id: "fb_001",
    source: "discord",
    user_tier: "enterprise",
    summary: "Workers AI response times inconsistent during peak hours",
    sentiment_score: -0.72,
    urgency_score: 8.5,
    created_at: "2024-01-15T09:23:00Z",
  },
  {
    id: "fb_002",
    source: "support",
    user_tier: "enterprise",
    summary: "Inference queue depth causing 5s+ delays on batch requests",
    sentiment_score: -0.85,
    urgency_score: 9.2,
    created_at: "2024-01-15T08:45:00Z",
  },
  {
    id: "fb_003",
    source: "github",
    user_tier: "pro",
    summary: "Timeout errors when processing images larger than 2MB",
    sentiment_score: -0.68,
    urgency_score: 7.8,
    created_at: "2024-01-14T22:15:00Z",
  },
  {
    id: "fb_004",
    source: "twitter",
    user_tier: "free",
    summary: "Model availability seems to drop during US business hours",
    sentiment_score: -0.55,
    urgency_score: 6.2,
    created_at: "2024-01-14T18:30:00Z",
  },
  {
    id: "fb_005",
    source: "forum",
    user_tier: "pro",
    summary: "Llama 2 70B frequently returns 503 errors",
    sentiment_score: -0.78,
    urgency_score: 8.1,
    created_at: "2024-01-14T15:20:00Z",
  },
  {
    id: "fb_006",
    source: "support",
    user_tier: "enterprise",
    summary: "Need SLA guarantees for inference latency, currently too variable",
    sentiment_score: -0.62,
    urgency_score: 7.5,
    created_at: "2024-01-14T11:00:00Z",
  },
  {
    id: "fb_007",
    source: "discord",
    user_tier: "pro",
    summary: "Cold start latency is killing our real-time use case",
    sentiment_score: -0.81,
    urgency_score: 8.8,
    created_at: "2024-01-13T20:45:00Z",
  },
  {
    id: "fb_008",
    source: "github",
    user_tier: "enterprise",
    summary: "Streaming responses sometimes truncate without error",
    sentiment_score: -0.73,
    urgency_score: 8.3,
    created_at: "2024-01-13T16:30:00Z",
  },
]

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    discord: "bg-[#5865F2]/10 text-[#5865F2]",
    github: "bg-[#24292F]/10 text-[#24292F]",
    support: "bg-[#F38020]/10 text-[#F38020]",
    twitter: "bg-[#1DA1F2]/10 text-[#1DA1F2]",
    forum: "bg-[#16A34A]/10 text-[#16A34A]",
  }

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[source] || "bg-muted text-muted-foreground"}`}>
      {source}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    enterprise: "bg-[#F38020] text-white",
    pro: "bg-[#0051AD] text-white",
    free: "bg-muted text-muted-foreground",
  }

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[tier] || "bg-muted text-muted-foreground"}`}>
      {tier}
    </span>
  )
}

export function SQLPlayground() {
  const [query, setQuery] = useState(defaultQuery)
  const [isRunning, setIsRunning] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRunQuery = async () => {
    setIsRunning(true)
    // Simulate query execution
    await new Promise((resolve) => setTimeout(resolve, 800))
    setHasResults(true)
    setIsRunning(false)
    toast.success("Query executed", {
      description: `Returned ${mockResults.length} rows in 0.${Math.floor(Math.random() * 9) + 1}s`,
    })
  }

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(query)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Query copied to clipboard")
  }

  const handleExportCSV = () => {
    toast.success("Exporting to CSV...", {
      description: "Download will start shortly.",
    })
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
            Connected to d1://productsense-enrichment
          </span>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="rounded-lg border border-border bg-[#1a1a2e] overflow-hidden">
        {/* Editor Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a3e] px-4 py-2">
          <span className="font-mono text-xs text-[#71717A]">query.sql</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-[#71717A] hover:text-white hover:bg-[#2a2a3e]"
              onClick={handleCopyQuery}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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

        {/* Editor Content */}
        <div className="p-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-32 bg-transparent font-mono text-sm text-[#E4E4E7] resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Line numbers simulation */}
        <div className="absolute left-0 top-0 p-4 font-mono text-xs text-[#4a4a5e] select-none pointer-events-none">
          {query.split("\n").map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>

      {/* Results Table */}
      {hasResults && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Results Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">
              {mockResults.length} rows returned
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleExportCSV}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground">id</th>
                  <th className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground">source</th>
                  <th className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground">user_tier</th>
                  <th className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground">summary</th>
                  <th className="px-4 py-2 text-right font-mono text-xs font-medium text-muted-foreground">sentiment</th>
                  <th className="px-4 py-2 text-right font-mono text-xs font-medium text-muted-foreground">urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockResults.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.id}</td>
                    <td className="px-4 py-2">
                      <SourceBadge source={row.source} />
                    </td>
                    <td className="px-4 py-2">
                      <TierBadge tier={row.user_tier} />
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground max-w-md truncate">{row.summary}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono text-xs ${row.sentiment_score < -0.7 ? "text-[#DC2626]" : "text-[#F38020]"}`}>
                        {row.sentiment_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono text-xs ${row.urgency_score >= 8 ? "text-[#DC2626]" : "text-foreground"}`}>
                        {row.urgency_score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasResults && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Run a query to see results here
          </p>
        </div>
      )}
    </div>
  )
}
