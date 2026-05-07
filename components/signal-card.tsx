"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { 
  ChevronRight, 
  Info, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  FileText, 
  MapPin,
  ExternalLink,
} from "lucide-react"
import { DrilldownDrawer } from "./drilldown-drawer"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import type { Signal, Criticality } from "@/lib/data"
import { cn } from "@/lib/utils"

interface SignalCardProps {
  signal: Signal
  isExpanded: boolean
  onToggleExpand: () => void
  rankChange?: number
  onReject?: (signalId: string) => void
  onPushToRoadmap?: (signalId: string, onRoadmap: boolean) => void
  onDraftPRD?: (signal: Signal) => void
}

function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  const config = {
    high: { bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", label: "High" },
    medium: { bg: "bg-[#FEF3E8]", text: "text-[#F38020]", label: "Med" },
    low: { bg: "bg-[#F4F4F5]", text: "text-[#71717A]", label: "Low" },
  }
  const c = config[criticality]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  )
}

function TrendIndicator({ trend }: { trend: Signal["trend"] }) {
  const config = {
    spiking: { bg: "bg-[#F38020]", label: "Spiking" },
    steady: { bg: "bg-[#0051AD]", label: "Steady" },
    declining: { bg: "bg-[#16A34A]", label: "Declining" },
  }
  const c = config[trend]

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", c.bg)} />
      <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
    </div>
  )
}

function RankChangeBadge({ change }: { change: number }) {
  if (change === 0) return null
  
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold",
        change > 0 ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEE2E2] text-[#DC2626]"
      )}
    >
      {change > 0 ? "+" : ""}{change}
    </span>
  )
}

// Integration icons
function LinearIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.51 11.37a9.21 9.21 0 0 0 9.12 9.12.46.46 0 0 0 .31-.78L3.8 10.57a.43.43 0 0 0-.29-.09.44.44 0 0 0-.48.45.43.43 0 0 0 .48.44z"/>
      <path d="M4.7 8.31l10.99 10.99a.46.46 0 0 0 .64 0 9.23 9.23 0 0 0-11.63-11.63.46.46 0 0 0 0 .64z"/>
      <path d="M6.89 6.06l11.05 11.05a.46.46 0 0 0 .73-.14 9.21 9.21 0 0 0-11.64-11.64.46.46 0 0 0-.14.73z"/>
      <path d="M9.68 4.43l9.89 9.89a.46.46 0 0 0 .78-.31 9.21 9.21 0 0 0-9.12-9.12.46.46 0 0 0-.55.54z"/>
    </svg>
  )
}

function JiraIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53z"/>
      <path d="M6.77 6.8a4.36 4.36 0 0 0 4.34 4.38h1.8v1.7c0 2.4 1.93 4.35 4.33 4.35V7.65a.84.84 0 0 0-.84-.84H6.77z"/>
      <path d="M2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.7c.01 2.39 1.95 4.34 4.35 4.35v-9.56a.84.84 0 0 0-.84-.84H2z"/>
    </svg>
  )
}

function SlackIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

export function SignalCard({ signal, isExpanded, onToggleExpand, rankChange = 0, onReject, onPushToRoadmap, onDraftPRD }: SignalCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const [scoreFlash, setScoreFlash] = useState(false)
  const prevScore = useRef(signal.scoreBreakdown.score)

  useEffect(() => {
    if (signal.scoreBreakdown.score !== prevScore.current) {
      prevScore.current = signal.scoreBreakdown.score
      setScoreFlash(true)
      const t = setTimeout(() => setScoreFlash(false), 1200)
      return () => clearTimeout(t)
    }
  }, [signal.scoreBreakdown.score])

  useEffect(() => {
    if (isExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [isExpanded])

  const handleExport = (platform: string) => {
    toast.success(`Signal synced to ${platform}`, {
      description: `SIG-${String(signal.number).padStart(3, "0")} has been exported.`,
    })
  }

  const handleDraftPRD = () => {
    if (onDraftPRD) {
      onDraftPRD(signal)
    } else {
      toast.info("Draft PRD", { description: "Open the Pulse tab to draft a PRD." })
    }
  }

  const [pushing, setPushing] = useState(false)

  const handleAddToRoadmap = async () => {
    if (pushing) return

    if (signal.onRoadmap) {
      setPushing(true)
      try {
        const res = await fetch(`/api/signals/${signal.id}/push-to-roadmap`, { method: "DELETE" })
        if (!res.ok) throw new Error()
        toast.success("Removed from roadmap", { description: "The signal is no longer tracked on the roadmap." })
        if (onPushToRoadmap) onPushToRoadmap(signal.id, false)
      } catch {
        toast.error("Failed to remove from roadmap")
      } finally {
        setPushing(false)
      }
      return
    }

    setPushing(true)
    try {
      const res = await fetch(`/api/signals/${signal.id}/push-to-roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${signal.product}: ${signal.theme}`,
          description: signal.suggestedAction,
          pmPriority: signal.criticality,
          devUrgency: signal.criticality,
        }),
      })
      if (res.status === 409) { toast.info("Already on roadmap"); return }
      if (!res.ok) throw new Error()
      toast.success("Pushed to roadmap", { description: "Visit the Roadmap tab to manage it." })
      if (onPushToRoadmap) onPushToRoadmap(signal.id, true)
    } catch {
      toast.error("Failed to push to roadmap")
    } finally {
      setPushing(false)
    }
  }

  const handleVote = (direction: "up" | "down") => {
    setVote(direction)
    toast.success(direction === "up" ? "Feedback recorded" : "Feedback noted", {
      description: direction === "up" 
        ? "This helps improve future suggestions." 
        : "We'll adjust the model accordingly.",
    })
  }

  const handleReject = () => {
    if (onReject) {
      onReject(signal.id)
    }
    toast.info("Signal dismissed", {
      description: "This signal won't appear in future briefs.",
    })
  }

  return (
    <div
      ref={cardRef}
      className="rounded-lg border border-border bg-card transition-shadow hover:shadow-sm"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <CriticalityBadge criticality={signal.criticality} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              SIG-{String(signal.number).padStart(3, "0")}
            </span>
            {rankChange !== 0 && <RankChangeBadge change={rankChange} />}
            <span className="text-muted-foreground">·</span>
            <span className="text-sm font-medium text-foreground">{signal.product}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {signal.theme}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-xs px-1.5 py-0.5 rounded transition-all duration-300",
              scoreFlash
                ? "bg-[#F38020] text-white scale-110"
                : "bg-muted text-muted-foreground"
            )}
          >
            {signal.scoreBreakdown.score.toFixed(1)}
          </span>
          <TrendIndicator trend={signal.trend} />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Evidence */}
        <p className="text-sm text-foreground leading-relaxed">{signal.evidence}</p>

        {/* Pull Quote */}
        <div className="mt-3 rounded border-l-2 border-[#F38020] bg-[#FEF3E8]/50 py-2 pl-3 pr-3">
          <p className="text-sm text-muted-foreground italic">
            &ldquo;{signal.pullQuote}&rdquo;
          </p>
        </div>

        {/* Suggested Action */}
        <div className="mt-4 rounded bg-muted/50 p-3">
          <div className="flex items-start gap-2">
            <span className="text-[#F38020] font-bold">→</span>
            <div className="flex-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested Action
              </span>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {signal.suggestedAction}
              </p>
            </div>
            {/* Action Feedback */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        vote === "up" && "bg-[#DCFCE7] text-[#16A34A]"
                      )}
                      onClick={() => handleVote("up")}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Good suggestion</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7",
                        vote === "down" && "bg-[#FEE2E2] text-[#DC2626]"
                      )}
                      onClick={() => handleVote("down")}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Not helpful</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Action Bridge Row */}
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          {/* Export Buttons */}
          <div className="flex items-center gap-1 rounded border border-border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[#0051AD] hover:bg-muted"
                    onClick={() => handleExport("Linear")}
                  >
                    <LinearIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export to Linear</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="h-4 w-px bg-border" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[#0051AD] hover:bg-muted"
                    onClick={() => handleExport("Jira")}
                  >
                    <JiraIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export to Jira</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="h-4 w-px bg-border" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[#0051AD] hover:bg-muted"
                    onClick={() => handleExport("Slack")}
                  >
                    <SlackIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share to Slack</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Product Actions */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs border-border text-[#0051AD]"
            onClick={handleDraftPRD}
          >
            <FileText className="h-3.5 w-3.5" />
            Draft PRD
          </Button>
          {signal.onRoadmap ? (
            <button
              onClick={handleAddToRoadmap}
              disabled={pushing}
              className="group inline-flex items-center gap-1.5 rounded border border-[#16A34A]/40 bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#16A34A] transition-colors hover:border-[#DC2626]/40 hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:opacity-60"
              title="Click to remove from roadmap"
            >
              <MapPin className="h-3.5 w-3.5 group-hover:hidden" />
              <X className="h-3.5 w-3.5 hidden group-hover:block" />
              <span className="group-hover:hidden">{pushing ? "Removing…" : "On Roadmap"}</span>
              <span className="hidden group-hover:inline">{pushing ? "Removing…" : "Remove"}</span>
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-border text-[#0051AD]"
              onClick={handleAddToRoadmap}
              disabled={pushing}
            >
              <MapPin className="h-3.5 w-3.5" />
              {pushing ? "Pushing…" : "→ Roadmap"}
            </Button>
          )}

          <div className="flex-1" />

          {/* Reject Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-[#DC2626]/70 hover:text-[#DC2626] hover:bg-[#FEE2E2]"
            onClick={handleReject}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleExpand}
              className="flex items-center text-sm font-medium text-[#0051AD] transition-colors hover:text-[#003d82]"
            >
              {isExpanded ? (
                <>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronRight className="mr-1 h-3.5 w-3.5" />
                  View {signal.itemCount} Items
                </>
              )}
            </button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
                        <Info className="mr-1 h-3.5 w-3.5" />
                        Score
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <ScoreBreakdown signal={signal} />
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View scoring breakdown</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{signal.itemCount} items</span>
            {signal.enterpriseCount > 0 && (
              <>
                <span>·</span>
                <span className="text-[#F38020]">{signal.enterpriseCount} enterprise</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drilldown Drawer */}
      {isExpanded && (
        <DrilldownDrawer items={signal.items} signalProduct={signal.product} />
      )}
    </div>
  )
}

function ScoreBreakdown({ signal }: { signal: Signal }) {
  const { scoreBreakdown } = signal

  const formula = `${scoreBreakdown.volume} × ${scoreBreakdown.urgency.toFixed(2)} × ${scoreBreakdown.sourceWeightAvg.toFixed(1)} × ${scoreBreakdown.themeBoost.toFixed(1)}`

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Score Calculation
        </h4>
      </div>
      <div className="p-4">
        {/* Formula Display */}
        <div className="mb-4 rounded bg-muted p-3 font-mono text-xs">
          <span className="text-muted-foreground">Volume × Urgency × SourceWeight × ThemeBoost</span>
          <div className="mt-1 text-foreground">{formula}</div>
          <div className="mt-1 text-[#F38020] font-semibold">
            = {scoreBreakdown.score.toFixed(1)}
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="space-y-2">
          <Row label="Volume" value={scoreBreakdown.volume} />
          <Row label="Urgency" value={scoreBreakdown.urgency.toFixed(2)} />
          <Row label="Source Weight (avg)" value={scoreBreakdown.sourceWeightAvg.toFixed(1)} />
          <Row label="Theme Boost" value={`×${scoreBreakdown.themeBoost.toFixed(1)}`} />
          <Row label="Recency Factor" value={scoreBreakdown.recency.toFixed(2)} />
          <Row
            label="Sentiment Δ"
            value={(scoreBreakdown.sentimentDelta >= 0 ? "+" : "") + scoreBreakdown.sentimentDelta.toFixed(1)}
            highlight={scoreBreakdown.sentimentDelta < 0}
          />
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono",
          highlight ? "text-[#DC2626]" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  )
}
