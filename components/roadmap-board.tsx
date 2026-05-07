"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Check, X, ChevronDown, ThumbsUp, ThumbsDown, ExternalLink, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { RoadmapItem, RoadmapStatus, DevUrgency } from "@/lib/data"

// ── localStorage vote tracking ────────────────────────────────────────────────
const VOTE_KEY = "ps_roadmap_votes"

function getStoredVotes(): Record<string, "up" | "down"> {
  try {
    return JSON.parse(localStorage.getItem(VOTE_KEY) ?? "{}")
  } catch { return {} }
}

function setStoredVote(id: string, direction: "up" | "down" | null) {
  const votes = getStoredVotes()
  if (direction === null) delete votes[id]
  else votes[id] = direction
  localStorage.setItem(VOTE_KEY, JSON.stringify(votes))
}

// ── Badge components ──────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }: { urgency: DevUrgency }) {
  const cfg = {
    high:   "bg-[#FEE2E2] text-[#DC2626]",
    medium: "bg-[#FEF3E8] text-[#F38020]",
    low:    "bg-[#F4F4F5] text-[#71717A]",
  }
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cfg[urgency])}>
      {urgency}
    </span>
  )
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const cfg: Record<RoadmapStatus, string> = {
    proposed:    "bg-[#EFF6FF] text-[#0051AD]",
    in_progress: "bg-[#FEF3E8] text-[#F38020]",
    shipped:     "bg-[#DCFCE7] text-[#16A34A]",
    declined:    "bg-[#F4F4F5] text-[#71717A]",
  }
  const labels: Record<RoadmapStatus, string> = {
    proposed: "Proposed", in_progress: "In Progress", shipped: "Shipped", declined: "Declined",
  }
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", cfg[status])}>
      {labels[status]}
    </span>
  )
}

// ── Vote button pair ──────────────────────────────────────────────────────────
function VoteButtons({ item, onVoted }: { item: RoadmapItem; onVoted: (id: string, up: number, down: number) => void }) {
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({})
  const [localUp,   setLocalUp]   = useState(item.upvotes)
  const [localDown, setLocalDown] = useState(item.downvotes)

  useEffect(() => { setVotes(getStoredVotes()) }, [])
  useEffect(() => { setLocalUp(item.upvotes); setLocalDown(item.downvotes) }, [item.upvotes, item.downvotes])

  const handleVote = useCallback(async (direction: "up" | "down") => {
    const current = votes[item.id] ?? null
    const next: "up" | "down" | null = current === direction ? null : direction

    // Optimistic update
    const newUp   = localUp   + (next === "up"   ? 1 : 0) - (current === "up"   ? 1 : 0)
    const newDown = localDown + (next === "down" ? 1 : 0) - (current === "down" ? 1 : 0)
    setLocalUp(newUp)
    setLocalDown(newDown)
    setVotes((v) => { const n = { ...v }; if (next === null) delete n[item.id]; else n[item.id] = next; return n })
    setStoredVote(item.id, next)

    try {
      const res = await fetch(`/api/roadmap/${item.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: next, previous: current }),
      })
      const data = await res.json()
      setLocalUp(data.upvotes)
      setLocalDown(data.downvotes)
      onVoted(item.id, data.upvotes, data.downvotes)
    } catch {
      // Roll back optimistic update on failure
      setLocalUp(item.upvotes)
      setLocalDown(item.downvotes)
      setVotes(getStoredVotes())
      toast.error("Vote failed — please try again")
    }
  }, [item.id, item.upvotes, item.downvotes, votes, localUp, localDown, onVoted])

  const myVote = votes[item.id] ?? null

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote("up")}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          myVote === "up"
            ? "bg-[#DCFCE7] text-[#16A34A] font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <ThumbsUp className="h-3 w-3" />
        {localUp}
      </button>
      <button
        onClick={() => handleVote("down")}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          myVote === "down"
            ? "bg-[#FEE2E2] text-[#DC2626] font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <ThumbsDown className="h-3 w-3" />
        {localDown}
      </button>
    </div>
  )
}

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({
  value, onSave, multiline = false, className = "",
}: { value: string; onSave: (v: string) => void; multiline?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => { if (draft.trim()) { onSave(draft.trim()); setEditing(false) } }
  const cancel = () => { setDraft(value); setEditing(false) }

  if (!editing) {
    return (
      <span
        className={cn("cursor-text hover:bg-muted/50 rounded px-0.5 -mx-0.5 transition-colors", className)}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || <span className="text-muted-foreground italic">Click to add…</span>}
      </span>
    )
  }

  return (
    <span className="flex items-start gap-1">
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={cn("flex-1 resize-none rounded border border-[#0051AD] bg-background px-1 py-0.5 text-sm focus:outline-none", className)}
          rows={3}
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
          className={cn("flex-1 rounded border border-[#0051AD] bg-background px-1 py-0.5 text-sm focus:outline-none", className)}
        />
      )}
      <button onClick={commit} className="mt-0.5 text-[#16A34A] hover:opacity-70"><Check className="h-4 w-4" /></button>
      <button onClick={cancel} className="mt-0.5 text-muted-foreground hover:opacity-70"><X className="h-4 w-4" /></button>
    </span>
  )
}

// ── Roadmap item card ─────────────────────────────────────────────────────────
function RoadmapCard({
  item, onUpdate, onDelete, onVoted, onGoToSignal,
}: {
  item: RoadmapItem
  onUpdate: (id: string, patch: Partial<RoadmapItem>) => void
  onDelete: (id: string) => void
  onVoted: (id: string, up: number, down: number) => void
  onGoToSignal?: (signalId: string) => void
}) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("itemId", item.id)
    e.dataTransfer.effectAllowed = "move"
    // Propagate up so the parent card is the drag image
    e.stopPropagation()
  }
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showUrgencyMenu, setShowUrgencyMenu] = useState(false)

  const patch = async (updates: Record<string, string>) => {
    onUpdate(item.id, updates as Partial<RoadmapItem>)
    try {
      await fetch(`/api/roadmap/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch { toast.error("Failed to save change") }
  }

  const handleDelete = async () => {
    onDelete(item.id)
    try {
      await fetch(`/api/roadmap/${item.id}`, { method: "DELETE" })
    } catch { toast.error("Failed to delete item") }
  }

  const STATUSES: RoadmapStatus[] = ["proposed", "in_progress", "shipped", "declined"]
  const URGENCIES: DevUrgency[]   = ["high", "medium", "low"]

  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* Drag handle — only this element is draggable so buttons below remain clickable */}
        <div
          className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          draggable
          onDragStart={handleDragStart}
          title="Drag to move"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 font-medium text-sm text-foreground leading-snug">
          <EditableField
            value={item.title}
            onSave={(v) => patch({ title: v })}
            className="font-medium"
          />
        </div>
        <button
          onClick={handleDelete}
          className="shrink-0 text-muted-foreground hover:text-[#DC2626] transition-colors"
          title="Delete item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      <div className="text-xs text-muted-foreground mb-3">
        <EditableField
          value={item.description}
          onSave={(v) => patch({ description: v })}
          multiline
        />
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {/* Status picker */}
        <div className="relative">
          <button
            onClick={() => { setShowStatusMenu((v) => !v); setShowUrgencyMenu(false) }}
            className="flex items-center gap-0.5"
          >
            <StatusBadge status={item.status} />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 rounded-md border border-border bg-card shadow-md py-1 min-w-[130px]">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => { patch({ status: s }); setShowStatusMenu(false) }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                    item.status === s && "font-semibold"
                  )}
                >
                  {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dev urgency picker */}
        <div className="relative">
          <button
            onClick={() => { setShowUrgencyMenu((v) => !v); setShowStatusMenu(false) }}
            className="flex items-center gap-0.5"
            title="Dev urgency"
          >
            <UrgencyBadge urgency={item.devUrgency} />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {showUrgencyMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 rounded-md border border-border bg-card shadow-md py-1 min-w-[100px]">
              {URGENCIES.map((u) => (
                <button
                  key={u}
                  onClick={() => { patch({ devUrgency: u }); setShowUrgencyMenu(false) }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors capitalize",
                    item.devUrgency === u && "font-semibold"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>

        {item.signalId && (
          <button
            onClick={() => onGoToSignal?.(item.signalId!)}
            className="ml-auto flex items-center gap-0.5 text-[10px] text-[#0051AD] hover:underline"
            title="Go to source signal"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            view signal
          </button>
        )}
      </div>

      {/* Vote row */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <VoteButtons item={item} onVoted={onVoted} />
        <span className="text-[10px] text-muted-foreground font-mono">
          net {item.upvotes - item.downvotes > 0 ? "+" : ""}{item.upvotes - item.downvotes}
        </span>
      </div>
    </div>
  )
}

// ── Add item form ─────────────────────────────────────────────────────────────
function AddItemForm({ onAdd }: { onAdd: (item: RoadmapItem) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [devUrgency, setDevUrgency] = useState<DevUrgency>("medium")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, devUrgency }),
      })
      const item = await res.json()
      onAdd(item)
      setTitle(""); setDescription(""); setDevUrgency("medium"); setOpen(false)
      toast.success("Item added to roadmap")
    } catch { toast.error("Failed to add item") }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add Item
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-[#0051AD]/30 bg-card p-4 space-y-3">
      <input
        autoFocus
        placeholder="Item title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#0051AD]"
      />
      <textarea
        placeholder="Description (optional)…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#0051AD]"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Dev urgency:</span>
        {(["high", "medium", "low"] as DevUrgency[]).map((u) => (
          <button
            key={u}
            onClick={() => setDevUrgency(u)}
            className={cn(
              "rounded px-2 py-0.5 text-xs capitalize transition-colors",
              devUrgency === u ? "bg-[#0051AD] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {u}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" className="text-xs h-7 bg-[#F38020] hover:bg-[#e0741b] text-white" onClick={submit} disabled={saving || !title.trim()}>
          {saving ? "Saving…" : "Add"}
        </Button>
      </div>
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────
export function RoadmapBoard({ onGoToSignal }: { onGoToSignal?: (signalId: string) => void }) {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeclined, setShowDeclined] = useState(false)
  const [dragOverStatus, setDragOverStatus] = useState<RoadmapStatus | null>(null)

  useEffect(() => {
    fetch("/api/roadmap")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => toast.error("Failed to load roadmap"))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = useCallback((item: RoadmapItem) => {
    setItems((prev) => [item, ...prev])
  }, [])

  const handleUpdate = useCallback((id: string, patch: Partial<RoadmapItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Item removed from roadmap")
  }, [])

  const handleVoted = useCallback((id: string, up: number, down: number) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, upvotes: up, downvotes: down } : i))
  }, [])

  const STATUS_GROUPS: { status: RoadmapStatus; label: string }[] = [
    { status: "proposed",    label: "Proposed" },
    { status: "in_progress", label: "In Progress" },
    { status: "shipped",     label: "Shipped" },
  ]

  const active   = items.filter((i) => i.status !== "declined")
  const declined = items.filter((i) => i.status === "declined")

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Product Roadmap</h2>
          <p className="text-sm text-muted-foreground">
            {active.length} active items · sorted by dev urgency then net votes
          </p>
        </div>
        <AddItemForm onAdd={handleAdd} />
      </div>

      {/* Status columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {STATUS_GROUPS.map(({ status, label }) => {
          const group = items.filter((i) => i.status === status)
          const isOver = dragOverStatus === status
          return (
            <div
              key={status}
              className={cn(
                "space-y-3 rounded-xl p-2 transition-colors",
                isOver && "bg-[#0051AD]/5 ring-2 ring-[#0051AD]/20 ring-inset"
              )}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
              onDragEnter={(e) => { e.preventDefault(); setDragOverStatus(status) }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null)
              }}
              onDrop={async (e) => {
                e.preventDefault()
                setDragOverStatus(null)
                const itemId = e.dataTransfer.getData("itemId")
                if (!itemId) return
                const dragged = items.find((i) => i.id === itemId)
                if (!dragged || dragged.status === status) return
                handleUpdate(itemId, { status })
                toast.success(`Moved to ${label}`)
                try {
                  await fetch(`/api/roadmap/${itemId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                  })
                } catch {
                  handleUpdate(itemId, { status: dragged.status })
                  toast.error("Failed to move item")
                }
              }}
            >
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {group.length}
                </span>
              </div>
              {group.length === 0 ? (
                <div className={cn(
                  "rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground transition-colors",
                  isOver ? "border-[#0051AD]/40 bg-[#0051AD]/5 text-[#0051AD]" : "border-border"
                )}>
                  {isOver ? "Drop here" : "No items"}
                </div>
              ) : (
                group.map((item) => (
                  <RoadmapCard
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onVoted={handleVoted}
                    onGoToSignal={onGoToSignal}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>

      {/* Declined bucket */}
      {declined.length > 0 && (
        <div>
          <button
            onClick={() => setShowDeclined((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDeclined && "rotate-180")} />
            {declined.length} declined item{declined.length !== 1 ? "s" : ""}
          </button>
          {showDeclined && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {declined.map((item) => (
                <RoadmapCard
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onVoted={handleVoted}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-sm font-medium text-foreground">No roadmap items yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Push signals from the Pulse tab or add items manually.
          </p>
        </div>
      )}
    </div>
  )
}
