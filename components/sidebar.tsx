"use client"

import { cn } from "@/lib/utils"
import { Activity, BarChart3, Database, Map, Radar, SlidersHorizontal } from "lucide-react"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "pulse",    label: "Pulse",    icon: Activity },
  { id: "signals",  label: "Signals",  icon: Radar },
  { id: "explorer", label: "Explorer", icon: Database },
  { id: "roadmap",  label: "Roadmap",  icon: Map },
  { id: "weights",  label: "Weights",  icon: SlidersHorizontal },
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F38020]">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 rounded-md px-2 py-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[#FEF3E8] text-[#F38020]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Status indicator */}
      <div className="border-t border-border p-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-2 w-2 items-center justify-center">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          </div>
          <span className="text-[9px] text-muted-foreground">Live</span>
        </div>
      </div>
    </aside>
  )
}
