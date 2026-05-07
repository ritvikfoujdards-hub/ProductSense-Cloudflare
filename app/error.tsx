"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("ProductSense error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] mx-auto">
          <span className="text-xl">⚠</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error.message ?? "An unexpected error occurred. The team has been notified."}
          </p>
        </div>
        {error.digest && (
          <p className="font-mono text-[10px] text-muted-foreground/60">ref: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>
            Go home
          </Button>
          <Button
            size="sm"
            className="bg-[#F38020] hover:bg-[#e0741b] text-white"
            onClick={reset}
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
