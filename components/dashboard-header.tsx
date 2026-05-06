"use client"

import { RefreshCw, Bell, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DashboardHeaderProps {
  lastBriefTime: string
  isLoading: boolean
  onRegenerate: () => void
  dateRange: string
  onDateRangeChange: (range: string) => void
}

export function DashboardHeader({ lastBriefTime, isLoading, onRegenerate, dateRange, onDateRangeChange }: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Title & Date */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">ProductSense</h1>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={onDateRangeChange} disabled={isLoading}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
              <SelectItem value="14d" className="text-xs">Last 14 Days</SelectItem>
              <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isLoading}
            className="h-8 gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Regenerating..." : "Regenerate Brief"}
          </Button>

          <div className="h-4 w-px bg-border mx-2" />

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F38020] text-[10px] font-semibold text-white">
              PM
            </div>
          </Button>
        </div>
      </div>
    </header>
  )
}
