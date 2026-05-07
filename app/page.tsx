"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { IntelligenceBento } from "@/components/intelligence-bento"
import { SignalCard } from "@/components/signal-card"
import { WeightsPanel } from "@/components/weights-panel"
import { SQLPlayground } from "@/components/sql-playground"
import { RoadmapBoard } from "@/components/roadmap-board"
import { PRDEditor } from "@/components/prd-editor"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import type { Brief, DashboardMetrics, Signal, Weights } from "@/lib/data"

function computeRankChanges(
  signals: Signal[],
  appliedWeights: Weights,
  liveWeights: Weights
): Record<string, number> {
  const score = (s: Signal, w: Weights) => {
    const srcAvg =
      s.items.reduce((acc, item) => acc + ((w.sources as Record<string, number>)[item.source] ?? 1), 0) /
      (s.items.length || 1)
    const themeBoost = w.themeBoosts.includes(s.theme) ? 1.5 : 1.0
    return s.scoreBreakdown.volume * s.scoreBreakdown.urgency * srcAvg * themeBoost
  }
  const appliedOrder = [...signals].sort((a, b) => score(b, appliedWeights) - score(a, appliedWeights))
  const liveOrder = [...signals].sort((a, b) => score(b, liveWeights) - score(a, liveWeights))
  const result: Record<string, number> = {}
  signals.forEach((s) => {
    const appliedRank = appliedOrder.findIndex((x) => x.id === s.id)
    const liveRank = liveOrder.findIndex((x) => x.id === s.id)
    result[s.id] = appliedRank - liveRank
  })
  return result
}

const emptyWeights: Weights = {
  sources: { discord: 1, github: 1.5, support: 3, twitter: 0.5, forum: 1 },
  themeBoosts: [],
  recencyHalfLife: 24,
  sentimentThreshold: -0.2,
}

export default function ProductSensePage() {
  const [activeTab, setActiveTab] = useState("pulse")
  const [brief, setBrief] = useState<Brief | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [weights, setWeights] = useState<Weights>(emptyWeights)
  const [liveWeights, setLiveWeights] = useState<Weights>(emptyWeights)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null)
  const [showMoreSignals, setShowMoreSignals] = useState(false)
  const [prdSignal, setPrdSignal] = useState<Signal | null>(null)
  const [dateRange, setDateRange] = useState("7d")

  // Initial data load from D1
  useEffect(() => {
    Promise.all([
      fetch("/api/brief").then((r) => r.json()),
      fetch("/api/metrics?range=7d").then((r) => r.json()),
      fetch("/api/weights").then((r) => r.json()),
    ])
      .then(([briefData, metricsData, weightsData]) => {
        setBrief(briefData)
        setMetrics(metricsData)
        setWeights(weightsData)
        setLiveWeights(weightsData)
      })
      .catch(() => toast.error("Failed to load data from D1"))
      .finally(() => setInitialLoading(false))
  }, [])

  const rankChanges = useMemo(
    () => (brief ? computeRankChanges(brief.signals, weights, liveWeights) : {}),
    [brief, weights, liveWeights]
  )

  // Shared helper — refreshes the top-4 tiles from the live metrics API.
  // Called after any mutation that can change signal ranking or volume.
  const refreshMetrics = useCallback(async () => {
    try {
      const metricsData = await fetch(`/api/metrics?range=${dateRange}`).then((r) => r.json())
      setMetrics(metricsData)
    } catch {
      // non-critical — tiles keep their last value
    }
  }, [dateRange])

  const handleRegenerate = useCallback(async () => {
    setIsLoading(true)
    setExpandedSignal(null)
    try {
      const data = await fetch("/api/brief/regenerate", { method: "POST" }).then((r) => r.json())
      setBrief(data)
      await refreshMetrics()
      toast.success("Brief regenerated", { description: "Signal rankings have been updated." })
    } catch {
      toast.error("Failed to regenerate brief")
    } finally {
      setIsLoading(false)
    }
  }, [refreshMetrics])

  const handleDateRangeChange = useCallback(async (range: string) => {
    setDateRange(range)
    setIsLoading(true)
    setExpandedSignal(null)
    try {
      const [metricsData] = await Promise.all([
        fetch(`/api/metrics?range=${range}`).then((r) => r.json()),
      ])
      setMetrics(metricsData)
    } catch {
      toast.error("Failed to refresh metrics")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleApplyWeights = useCallback(
    async (newWeights: Weights) => {
      setIsApplying(true)
      await new Promise((r) => setTimeout(r, 1500))
      setIsApplying(false)
      setIsLoading(true)
      setExpandedSignal(null)
      try {
        const res = await fetch("/api/weights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newWeights),
        })
        const { brief: newBrief } = await res.json()
        setBrief(newBrief)
        setWeights(newWeights)
        setLiveWeights(newWeights)
        await refreshMetrics()
        toast.success("Weights applied", { description: "Brief regenerated with new parameters." })
      } catch {
        toast.error("Failed to apply weights")
      } finally {
        setIsLoading(false)
      }
    },
    [refreshMetrics]
  )

  const handleRejectSignal = useCallback(async (signalId: string) => {
    try {
      await fetch(`/api/signals/${signalId}/dismiss`, { method: "POST" })
      setBrief((prev) =>
        prev ? { ...prev, signals: prev.signals.filter((s) => s.id !== signalId) } : prev
      )
      refreshMetrics() // fire-and-forget — dismissed signal can change topTheme
    } catch {
      toast.error("Failed to dismiss signal")
    }
  }, [refreshMetrics])

  const handlePushToRoadmap = useCallback((signalId: string, onRoadmap: boolean) => {
    setBrief((prev) =>
      prev
        ? { ...prev, signals: prev.signals.map((s) => s.id === signalId ? { ...s, onRoadmap } : s) }
        : prev
    )
  }, [])

  const handleToggleSignal = useCallback((signalId: string) => {
    setExpandedSignal((prev) => (prev === signalId ? null : signalId))
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  const showSkeleton = initialLoading || isLoading

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="pl-16">
        <DashboardHeader
          lastBriefTime={brief?.generatedAt ?? "—"}
          isLoading={isLoading}
          onRegenerate={handleRegenerate}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
        />

        <main className="p-6">
          {activeTab === "pulse" && (
            <>
              <IntelligenceBento
                metrics={metrics ?? {
                  sentimentScore: 0,
                  sentimentChange: 0,
                  feedbackVolume24h: 0,
                  volumeChange: 0,
                  topTheme: "—",
                  themeCount: 0,
                  pipelineStatus: "healthy",
                  lastProcessed: "—",
                }}
                isLoading={showSkeleton}
                dateRange={dateRange}
              />

              <div className="mt-8 mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Active Signals</h2>
                  <p className="text-sm text-muted-foreground">
                    Prioritized by calculated score. Click a signal to drill down.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: <span className="font-mono">{brief?.generatedAt ?? "—"}</span>
                </div>
              </div>

              <div className="space-y-4">
                {!showSkeleton && brief?.signals.slice(0, showMoreSignals ? 5 : 3).map((signal, index) => (
                  <SignalCard
                    key={signal.id}
                    signal={{ ...signal, number: index + 1 }}
                    isExpanded={expandedSignal === signal.id}
                    onToggleExpand={() => handleToggleSignal(signal.id)}
                    rankChange={rankChanges[signal.id] ?? 0}
                    onReject={handleRejectSignal}
                    onPushToRoadmap={handlePushToRoadmap}
                    onDraftPRD={setPrdSignal}
                  />
                ))}

                {!showSkeleton && (brief?.signals.length ?? 0) > 3 && (
                  <button
                    onClick={() => setShowMoreSignals((v) => !v)}
                    className="w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                  >
                    {showMoreSignals
                      ? "Show fewer signals"
                      : `Show ${Math.min((brief?.signals.length ?? 0) - 3, 2)} more signal${Math.min((brief?.signals.length ?? 0) - 3, 2) !== 1 ? "s" : ""}`}
                  </button>
                )}

                {showSkeleton && (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-5 w-12 animate-pulse rounded bg-muted" />
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          </div>
                          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                        </div>
                        <div className="space-y-3">
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                          <div className="h-12 w-full animate-pulse rounded bg-muted" />
                          <div className="h-16 w-full animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "signals" && (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Last Run Signals</h2>
                <p className="text-sm text-muted-foreground">
                  All {Math.min(brief?.signals.length ?? 0, 10)} signals from the most recent brief · sorted by score
                </p>
              </div>
              <div className="space-y-4">
                {showSkeleton && [1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-4">
                    <div className="h-5 w-full animate-pulse rounded bg-muted mb-3" />
                    <div className="h-12 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
                {!showSkeleton && (brief?.signals ?? []).slice(0, 10).map((signal, index) => (
                  <SignalCard
                    key={signal.id}
                    signal={{ ...signal, number: index + 1 }}
                    isExpanded={expandedSignal === signal.id}
                    onToggleExpand={() => handleToggleSignal(signal.id)}
                    rankChange={0}
                    onReject={handleRejectSignal}
                    onPushToRoadmap={handlePushToRoadmap}
                    onDraftPRD={setPrdSignal}
                  />
                ))}
                {!showSkeleton && !brief?.signals.length && (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No signals yet — generate a brief to populate this view.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "explorer" && <SQLPlayground />}

          {activeTab === "roadmap" && (
            <RoadmapBoard
              onGoToSignal={(signalId) => {
                setActiveTab("pulse")
                setExpandedSignal(signalId)
              }}
            />
          )}

          {activeTab === "weights" && (
            <WeightsPanel
              weights={weights}
              onApply={handleApplyWeights}
              onWeightsChange={setLiveWeights}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>

      {/* PRD Editor */}
      {prdSignal && (
        <PRDEditor signal={prdSignal} onClose={() => setPrdSignal(null)} />
      )}

      {/* Workers AI Processing Overlay */}
      {isApplying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card px-8 py-6 flex flex-col items-center gap-3 shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F38020] border-t-transparent" />
            <p className="text-sm font-medium text-foreground">Processing via Workers AI</p>
            <p className="text-xs text-muted-foreground">Reweighting signal feed…</p>
          </div>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  )
}
