import { NextResponse } from "next/server"
import type { Signal } from "@/lib/data"

function buildPrompt(signal: Signal): string {
  return `You are a Senior Product Manager at Cloudflare writing a "Zeroth Draft PRD" to drive stakeholder alignment on a product signal.

Signal data:
- Product: ${signal.product}
- Theme: ${signal.theme}
- Criticality: ${signal.criticality}
- Trend: ${signal.trend}
- Priority Score: ${signal.scoreBreakdown.score.toFixed(1)} out of ~40
- Feedback items: ${signal.itemCount} total, ${signal.enterpriseCount} from Enterprise customers
- Evidence: ${signal.evidence}
- Representative customer quote: "${signal.pullQuote}"
- Suggested action: ${signal.suggestedAction}

Write a concise Zeroth Draft PRD using markdown with exactly these sections:

## TL;DR
Three sentences max. What is happening, who it affects, and what we will do. Written for a VP-level reader.

## Problem Statement
Describe the problem with specifics. Quantify the scale and business impact where possible.

## Who Is Affected
Customer segments and their exposure. Emphasise enterprise impact if applicable.

## Evidence
Key data points from the signal. Include the representative quote in a blockquote (> "quote").

## Proposed Solution
Based on the suggested action. Describe outcomes, not implementation details. Keep it option-agnostic.

## Priority Justification
Why this criticality level? What are the consequences of a one-quarter delay?

## Success Metrics
2–4 measurable outcomes that define resolution. Be specific.

## Open Questions
3–5 questions for stakeholder discussion. What do we not yet know?

## Stakeholder Sign-off Required
List the exact roles that must align: PM, Engineering Lead, Design, Legal (if applicable), Security (if applicable).

Keep the whole document under 600 words. This is a zeroth draft — designed to spark discussion, not be the final word.`
}

export async function POST(req: Request) {
  try {
    const { signal }: { signal: Signal } = await req.json()
    const messages = [{ role: "user" as const, content: buildPrompt(signal) }]

    // Native Workers AI binding (production on Cloudflare)
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare")
      const { env } = getCloudflareContext()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (env as any).AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages,
        stream: true,
        max_tokens: 1024,
      })
      return new Response(result as ReadableStream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      })
    } catch {
      // REST fallback (local dev)
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CF_KV_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages, stream: true, max_tokens: 1024 }),
        }
      )
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`AI REST error ${res.status}: ${err}`)
      }
      return new Response(res.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      })
    }
  } catch (err) {
    console.error("POST /api/prd/generate error:", err)
    return NextResponse.json({ error: "Failed to generate PRD" }, { status: 500 })
  }
}
