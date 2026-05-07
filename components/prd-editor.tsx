"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Copy, Check, RefreshCw, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Signal } from "@/lib/data"

// ── Inline markdown renderer ──────────────────────────────────────────────────
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MarkdownDoc({ text, streaming }: { text: string; streaming: boolean }) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let listBuf: string[] = []

  const flushList = () => {
    if (!listBuf.length) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-2 ml-5 list-disc space-y-1">
        {listBuf.map((item, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    )
    listBuf = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("## ")) {
      flushList()
      nodes.push(<h2 key={i} className="mt-6 mb-2 text-base font-bold text-foreground border-b border-border pb-1">{line.slice(3)}</h2>)
    } else if (line.startsWith("### ")) {
      flushList()
      nodes.push(<h3 key={i} className="mt-4 mb-1 text-sm font-semibold text-foreground">{line.slice(4)}</h3>)
    } else if (line.startsWith("# ")) {
      flushList()
      nodes.push(<h1 key={i} className="mt-2 mb-3 text-lg font-bold text-foreground">{line.slice(2)}</h1>)
    } else if (line.startsWith("> ")) {
      flushList()
      nodes.push(
        <blockquote key={i} className="my-3 border-l-2 border-[#F38020] pl-4 italic text-sm text-muted-foreground">
          <InlineText text={line.slice(2)} />
        </blockquote>
      )
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(line.slice(2))
    } else if (line.trim() === "") {
      flushList()
      if (nodes.length) nodes.push(<div key={`sp-${i}`} className="h-2" />)
    } else {
      flushList()
      nodes.push(
        <p key={i} className="text-sm text-foreground leading-relaxed">
          <InlineText text={line} />
        </p>
      )
    }
  }
  flushList()

  return (
    <div className="space-y-0.5">
      {nodes}
      {streaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-[#F38020] align-middle ml-0.5" />
      )}
    </div>
  )
}

// ── PRD Editor ────────────────────────────────────────────────────────────────
interface PRDEditorProps {
  signal: Signal
  onClose: () => void
}

export function PRDEditor({ signal, onClose }: PRDEditorProps) {
  const [content, setContent] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setContent("")
    setStreaming(true)

    try {
      const res = await fetch("/api/prd/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6).trim()
          if (payload === "[DONE]") break
          try {
            const parsed = JSON.parse(payload)
            const token: string = parsed.response ?? parsed.token ?? ""
            if (token) setContent((prev) => prev + token)
          } catch { /* incomplete JSON chunk — skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      console.error("PRD generation error:", err)
      toast.error("Failed to generate PRD — please try again")
      setContent((prev) => prev || "## Error\n\nCould not generate draft. Please retry.")
    } finally {
      setStreaming(false)
    }
  }, [signal])

  useEffect(() => {
    generate()
    return () => abortRef.current?.abort()
  }, [generate])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [content])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("PRD copied to clipboard")
  }

  const critColor =
    signal.criticality === "high" ? "text-[#DC2626]" :
    signal.criticality === "medium" ? "text-[#F38020]" : "text-[#71717A]"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl h-[88vh] rounded-xl border border-border bg-card shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F38020]/10">
              <FileText className="h-4 w-4 text-[#F38020]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zeroth Draft PRD · {signal.product}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{signal.theme}</p>
            </div>
            {streaming && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F38020]/10 px-2.5 py-1 text-[10px] font-medium text-[#F38020]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Workers AI drafting…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleCopy}
              disabled={!content || streaming}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={generate}
              disabled={streaming}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", streaming && "animate-spin")} />
              Regenerate
            </Button>
            <button
              onClick={onClose}
              className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Document body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
          {!content && streaming && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-[#F38020]" />
              <p className="text-sm">Workers AI is drafting your PRD…</p>
            </div>
          )}
          {content && <MarkdownDoc text={content} streaming={streaming} />}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-2.5 flex items-center justify-between bg-muted/30 rounded-b-xl">
          <p className="text-[10px] text-muted-foreground">
            Generated by Cloudflare Workers AI · For stakeholder alignment only
          </p>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", critColor)}>
            {signal.criticality} criticality
          </span>
        </div>
      </div>
    </div>
  )
}
