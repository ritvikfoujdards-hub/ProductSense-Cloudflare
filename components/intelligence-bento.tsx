"use client"

import { useState, useEffect } from "react"
import { DashboardMetrics } from "@/lib/data"
import { Activity, ArrowDown, ArrowUp, CheckCircle2, MessageSquare, TrendingUp } from "lucide-react"

interface IntelligenceBentoProps {
  metrics: DashboardMetrics
  isLoading?: boolean
  dateRange?: string
}

// Mini sparkline SVG component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 60
  const height = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

const sparklineDataByRange: Record<string, number[]> = {
  "7d":  [-0.20, -0.25, -0.30, -0.28, -0.35, -0.32, -0.34],
  "14d": [-0.15, -0.18, -0.20, -0.25, -0.22, -0.28, -0.30, -0.27, -0.32, -0.30, -0.34, -0.31, -0.35, -0.34],
  "30d": [-0.10, -0.12, -0.14, -0.13, -0.16, -0.18, -0.17, -0.20, -0.19, -0.22, -0.21, -0.24, -0.23, -0.26, -0.25, -0.27, -0.26, -0.28, -0.27, -0.30, -0.29, -0.31, -0.30, -0.32, -0.31, -0.33, -0.32, -0.34, -0.33, -0.34],
}

export function IntelligenceBento({ metrics, isLoading, dateRange = "7d" }: IntelligenceBentoProps) {
  const [syncMinutes, setSyncMinutes] = useState(2)

  useEffect(() => {
    const interval = setInterval(() => setSyncMinutes((m) => m + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const sentimentTrendData = sparklineDataByRange[dateRange] ?? sparklineDataByRange["7d"]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Sentiment Score */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Sentiment</span>
          </div>
          {/* Sparkline */}
          <Sparkline 
            data={sentimentTrendData} 
            color={metrics.sentimentChange < 0 ? "#DC2626" : "#16A34A"} 
          />
        </div>
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums">
              {metrics.sentimentScore.toFixed(2)}
            </span>
          )}
          <span
            className={`flex items-center text-xs font-medium ${
              metrics.sentimentChange < 0 ? "text-[#DC2626]" : "text-[#16A34A]"
            }`}
          >
            {metrics.sentimentChange < 0 ? (
              <ArrowDown className="h-3 w-3 mr-0.5" />
            ) : (
              <ArrowUp className="h-3 w-3 mr-0.5" />
            )}
            {Math.abs(metrics.sentimentChange)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">vs. last week</p>
      </div>

      {/* Feedback Volume */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Volume (24h)</span>
        </div>
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums">
              {metrics.feedbackVolume24h.toLocaleString()}
            </span>
          )}
          <span
            className={`flex items-center text-xs font-medium ${
              metrics.volumeChange > 0 ? "text-[#F38020]" : "text-[#16A34A]"
            }`}
          >
            {metrics.volumeChange > 0 ? (
              <ArrowUp className="h-3 w-3 mr-0.5" />
            ) : (
              <ArrowDown className="h-3 w-3 mr-0.5" />
            )}
            {Math.abs(metrics.volumeChange)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">items processed</p>
      </div>

      {/* Top Theme */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Top Theme</span>
        </div>
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <span className="text-lg font-semibold">{metrics.topTheme}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {metrics.themeCount} signals this week
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              metrics.pipelineStatus === "healthy"
                ? "bg-[#16A34A] animate-pulse"
                : metrics.pipelineStatus === "degraded"
                ? "bg-[#F38020]"
                : "bg-[#DC2626]"
            }`}
          />
          <span className="text-lg font-semibold capitalize">{metrics.pipelineStatus}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Last sync: {syncMinutes} min ago
        </p>
      </div>
    </div>
  )
}
