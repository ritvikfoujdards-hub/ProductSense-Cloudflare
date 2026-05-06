"use client"

import { useState } from "react"
import { ExternalLink, MessageCircle, Github, Headphones, Twitter, MessageSquare } from "lucide-react"
import type { FeedbackItem, Source, Sentiment } from "@/lib/data"
import { cn } from "@/lib/utils"

interface DrilldownDrawerProps {
  items: FeedbackItem[]
  signalProduct: string
}

function SourceIcon({ source }: { source: Source }) {
  const iconMap = {
    discord: MessageCircle,
    github: Github,
    support: Headphones,
    twitter: Twitter,
    forum: MessageSquare,
  }
  const Icon = iconMap[source]
  return <Icon className="h-4 w-4" />
}

function SentimentDot({ sentiment }: { sentiment: Sentiment }) {
  const colors = {
    negative: "bg-[#DC2626]",
    neutral: "bg-[#71717A]",
    positive: "bg-[#16A34A]",
  }
  return <span className={cn("h-1.5 w-1.5 rounded-full", colors[sentiment])} />
}

function TierBadge({ tier }: { tier: FeedbackItem["customerTier"] }) {
  const config = {
    Enterprise: { bg: "bg-[#FEF3E8]", text: "text-[#F38020]", border: "border-[#F38020]/20" },
    Business: { bg: "bg-[#E6F0FA]", text: "text-[#0051AD]", border: "border-[#0051AD]/20" },
    Pro: { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", border: "border-[#16A34A]/20" },
    Free: { bg: "bg-[#F4F4F5]", text: "text-[#71717A]", border: "border-[#71717A]/20" },
  }
  const c = config[tier]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
        c.bg,
        c.text,
        c.border
      )}
    >
      {tier}
    </span>
  )
}

export function DrilldownDrawer({ items, signalProduct }: DrilldownDrawerProps) {
  const [filter, setFilter] = useState<Source | "all">("all")

  const filteredItems = filter === "all" ? items : items.filter((item) => item.source === filter)

  const sources: (Source | "all")[] = ["all", "discord", "github", "support", "twitter", "forum"]

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Feedback Log
          </h3>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {filteredItems.length} items
          </span>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-1">
          {sources.map((source) => (
            <button
              key={source}
              onClick={() => setFilter(source)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                filter === source
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {source === "all" ? "All" : source.charAt(0).toUpperCase() + source.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Log Items */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredItems.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
              index !== filteredItems.length - 1 && "border-b border-border"
            )}
          >
            {/* Timestamp Column */}
            <div className="w-16 shrink-0">
              <span className="font-mono text-xs text-muted-foreground">{item.timestamp}</span>
            </div>

            {/* Source Icon */}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <SourceIcon source={item.source} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground truncate">
                  {item.author}
                </span>
                <TierBadge tier={item.customerTier} />
                <SentimentDot sentiment={item.sentiment} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.snippet}</p>
            </div>

            {/* External Link */}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
