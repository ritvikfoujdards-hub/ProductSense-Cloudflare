"use client"

import { useState, useCallback, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { IntelligenceBento } from "@/components/intelligence-bento"
import { SignalCard } from "@/components/signal-card"
import { WeightsPanel } from "@/components/weights-panel"
import { SQLPlayground } from "@/components/sql-playground"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  mockBrief,
  altMockBrief,
  mockDashboardMetrics,
  defaultWeights,
  type Brief,
  type Signal,
  type Weights,
} from "@/lib/data"

function computeRankChanges(
  signals: Signal[],
  appliedWeights: Weights,
  liveWeights: Weights
): Record<string, number> {
  const score = (s: Signal, w: Weights) => {
    const srcAvg =
      s.items.reduce((acc, item) => acc + (w.sources[item.source] ?? 1), 0) /
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

export default function ProductSensePage() {
  const [activeTab, setActiveTab] = useState("pulse")
  const [brief, setBrief] = useState<Brief>(mockBrief)
  const [weights, setWeights] = useState<Weights>(defaultWeights)
  const [liveWeights, setLiveWeights] = useState<Weights>(defaultWeights)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState("7d")

  const rankChanges = useMemo(
    () => computeRankChanges(brief.signals, weights, liveWeights),
    [brief.signals, weights, liveWeights]
  )

  const handleRegenerate = useCallback(async () => {
    setIsLoading(true)
    setExpandedSignal(null)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setBrief((prev) => (prev === mockBrief ? altMockBrief : mockBrief))
    setIsLoading(false)
    toast.success("Brief regenerated", {
      description: "Signal rankings have been updated.",
    })
  }, [])

  const handleDateRangeChange = useCallback(async (range: string) => {
    setDateRange(range)
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }, [])

  const handleApplyWeights = useCallback(async (newWeights: Weights) => {
    setIsApplying(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsApplying(false)

    setIsLoading(true)
    setExpandedSignal(null)
    setWeights(newWeights)
    setLiveWeights(newWeights)

    await new Promise((resolve) => setTimeout(resolve, 500))

    const supportLowered = newWeights.sources.support < defaultWeights.sources.support
    setBrief(supportLowered ? altMockBrief : mockBrief)

    setIsLoading(false)
    toast.success("Weights applied", {
      description: "Brief regenerated with new parameters.",
    })
  }, [])

  const handleToggleSignal = useCallback((signalId: string) => {
    setExpandedSignal((prev) => (prev === signalId ? null : signalId))
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="pl-16">
        <DashboardHeader
          lastBriefTime={brief.generatedAt}
          isLoading={isLoading}
          onRegenerate={handleRegenerate}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
        />

        <main className="p-6">
          {activeTab === "pulse" && (
            <>
              <IntelligenceBento metrics={mockDashboardMetrics} isLoading={isLoading} dateRange={dateRange} />

              <div className="mt-8 mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Active Signals</h2>
                  <p className="text-sm text-muted-foreground">
                    Prioritized by calculated score. Click a signal to drill down.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: <span className="font-mono">{brief.generatedAt}</span>
                </div>
              </div>

              <div className="space-y-4">
                {!isLoading &&
                  brief.signals.map((signal, index) => (
                    <SignalCard
                      key={signal.id}
                      signal={{ ...signal, number: index + 1 }}
                      isExpanded={expandedSignal === signal.id}
                      onToggleExpand={() => handleToggleSignal(signal.id)}
                      rankChange={rankChanges[signal.id] ?? 0}
                    />
                  ))}

                {isLoading && (
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
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">Signals Explorer</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Full signal history and search coming soon.
              </p>
            </div>
          )}

          {activeTab === "explorer" && <SQLPlayground />}

          {activeTab === "roadmap" && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">Roadmap</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Signal-to-roadmap pipeline coming soon.
              </p>
            </div>
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
