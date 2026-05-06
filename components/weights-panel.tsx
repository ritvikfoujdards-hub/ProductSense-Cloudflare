"use client"

import { useState, useEffect } from "react"
import { RotateCcw, Save, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { themes, type Weights, defaultWeights } from "@/lib/data"

interface WeightsPanelProps {
  weights: Weights
  onApply: (weights: Weights) => void
  onWeightsChange?: (weights: Weights) => void
  isLoading?: boolean
}

export function WeightsPanel({ weights, onApply, onWeightsChange, isLoading }: WeightsPanelProps) {
  const [localWeights, setLocalWeights] = useState<Weights>(weights)
  const [pendingChanges, setPendingChanges] = useState(0)

  useEffect(() => {
    setLocalWeights(weights)
  }, [weights])

  useEffect(() => {
    let changes = 0
    Object.keys(localWeights.sources).forEach((key) => {
      const k = key as keyof typeof localWeights.sources
      if (localWeights.sources[k] !== weights.sources[k]) {
        changes++
      }
    })
    const addedThemes = localWeights.themeBoosts.filter(
      (t) => !weights.themeBoosts.includes(t)
    ).length
    const removedThemes = weights.themeBoosts.filter(
      (t) => !localWeights.themeBoosts.includes(t)
    ).length
    changes += addedThemes + removedThemes
    if (localWeights.recencyHalfLife !== weights.recencyHalfLife) changes++
    if (localWeights.sentimentThreshold !== weights.sentimentThreshold) changes++
    setPendingChanges(changes)
  }, [localWeights, weights])

  const handleSourceChange = (source: keyof Weights["sources"], value: number) => {
    setLocalWeights((prev) => {
      const next = { ...prev, sources: { ...prev.sources, [source]: Math.max(0, Math.min(5, value)) } }
      onWeightsChange?.(next)
      return next
    })
  }

  const handleThemeToggle = (theme: string, checked: boolean) => {
    setLocalWeights((prev) => {
      const next = {
        ...prev,
        themeBoosts: checked ? [...prev.themeBoosts, theme] : prev.themeBoosts.filter((t) => t !== theme),
      }
      onWeightsChange?.(next)
      return next
    })
  }

  const handleRecencyChange = (value: number) => {
    setLocalWeights((prev) => {
      const next = { ...prev, recencyHalfLife: Math.max(1, Math.min(168, value)) }
      onWeightsChange?.(next)
      return next
    })
  }

  const handleSentimentChange = (value: number) => {
    setLocalWeights((prev) => {
      const next = { ...prev, sentimentThreshold: Math.max(-1, Math.min(0, value)) }
      onWeightsChange?.(next)
      return next
    })
  }

  const handleReset = () => {
    setLocalWeights(defaultWeights)
  }

  const handleApply = () => {
    onApply(localWeights)
  }

  const sourceLabels: Record<keyof Weights["sources"], string> = {
    discord: "Discord",
    github: "GitHub Issues",
    support: "Support Tickets",
    twitter: "Twitter/X",
    forum: "Community Forum",
  }

  const sourceDescriptions: Record<keyof Weights["sources"], string> = {
    discord: "Weight for Discord community feedback",
    github: "Weight for GitHub issues and discussions",
    support: "Weight for customer support tickets",
    twitter: "Weight for social media mentions",
    forum: "Weight for community forum posts",
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Signal Weights</h2>
            <p className="text-sm text-muted-foreground">
              Configure how different sources and themes affect signal prioritization.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="h-8 gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isLoading || pendingChanges === 0}
              className="h-8 gap-2 bg-[#F38020] hover:bg-[#e0741b] text-white"
            >
              <Save className="h-3.5 w-3.5" />
              Apply Changes
              {pendingChanges > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {pendingChanges}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Source Weights */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source Weights
              </h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Higher weights give more importance to feedback from that source in the final score calculation.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-5">
              {(Object.keys(localWeights.sources) as Array<keyof Weights["sources"]>).map((source) => (
                <div key={source}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-foreground">{sourceLabels[source]}</Label>
                    <span className="font-mono text-sm text-muted-foreground">
                      {localWeights.sources[source].toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[localWeights.sources[source]]}
                    onValueChange={([value]) => handleSourceChange(source, value)}
                    min={0}
                    max={5}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Theme Boosts */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Theme Boosts
              </h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Boosted themes get a 1.5x multiplier in the score calculation.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-3">
              {themes.map((theme) => (
                <div
                  key={theme}
                  className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`theme-${theme}`}
                      checked={localWeights.themeBoosts.includes(theme)}
                      onCheckedChange={(checked) => handleThemeToggle(theme, checked as boolean)}
                    />
                    <Label htmlFor={`theme-${theme}`} className="text-sm text-foreground cursor-pointer">
                      {theme}
                    </Label>
                  </div>
                  {localWeights.themeBoosts.includes(theme) && (
                    <span className="text-xs font-medium text-[#F38020]">1.5x</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Advanced
              </h3>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Fine-tune recency decay and sentiment sensitivity.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-6">
              {/* Recency Half-Life */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-foreground">Recency Half-Life</Label>
                  <span className="font-mono text-sm text-muted-foreground">
                    {localWeights.recencyHalfLife}h
                  </span>
                </div>
                <Slider
                  value={[localWeights.recencyHalfLife]}
                  onValueChange={([value]) => handleRecencyChange(value)}
                  min={1}
                  max={168}
                  step={1}
                  className="w-full"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Feedback loses half its recency weight after this many hours.
                </p>
              </div>

              {/* Sentiment Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-foreground">Sentiment Threshold</Label>
                  <span className="font-mono text-sm text-muted-foreground">
                    {localWeights.sentimentThreshold.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[localWeights.sentimentThreshold]}
                  onValueChange={([value]) => handleSentimentChange(value)}
                  min={-1}
                  max={0}
                  step={0.1}
                  className="w-full"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Only surface signals with sentiment below this threshold.
                </p>
              </div>

              {/* Formula Preview */}
              <div className="rounded bg-muted p-3 mt-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Score Formula
                </p>
                <code className="text-xs text-foreground">
                  Volume × Urgency × SourceWeight × ThemeBoost × Recency
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
