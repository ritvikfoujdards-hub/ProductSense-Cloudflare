#!/usr/bin/env node
// One-time script: adds 5 new signals + enrichment items to D1, then re-ranks the brief.

// Get these from environment variables or .env.local
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || ""
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID || ""
const CF_API_TOKEN = process.env.CF_API_TOKEN || ""
const BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`

async function q(sql, params = []) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(`D1 error: ${JSON.stringify(json.errors)}`)
  return json.result[0]?.results ?? []
}

const now = new Date().toISOString()
const ts = Date.now()

// Get current brief
const [brief] = await q("SELECT id FROM briefs ORDER BY created_at DESC LIMIT 1")
const briefId = brief.id
console.log(`Brief: ${briefId}`)

// New signals — scores designed to interleave with existing (37.9, 29.7, 15.0)
const SIGNALS = [
  {
    id: `sig-ai-rate-${ts}`,
    product: "Workers AI",
    theme: "Rate Limits",
    criticality: "high",
    trend: "spiking",
    evidence: "Enterprise customers hitting AI inference rate limits in production. 47 support tickets in 7 days, 3× spike vs prior week. The 1 000 req/day default cap is too low for real workloads.",
    prev_sentiment: -0.30,
    curr_sentiment: -0.72,
    pull_quote: "Our AI pipeline hit the limit at 2 am and customers saw 6 hours of degraded service. We need higher limits or better alerting.",
    suggested_action: "Introduce tiered AI rate limits (Paid: 10k/day, Enterprise: negotiated), add Retry-After header on 429s, and expose a live usage dashboard.",
    item_count: 12,
    enterprise_count: 5,
    // score = volume × urgency × src_weight_avg × theme_boost × recency = 12×0.88×2.1×1.0×0.91 ≈ 20.2
    volume: 12, urgency: 0.88, source_weight_avg: 2.1, theme_boost: 1.0, recency: 0.91, sentiment_delta: -0.42,
    items: [
      { source: "support", author: "Marcus T.", tier: "Enterprise", sent: -0.81, urg: 0.93, text: "Our Workers AI pipeline hit the 1000 req/day limit at 2am — customers saw 6h of degraded service. Need higher limits or SLA-backed alerting." },
      { source: "discord", author: "aibuilder99", tier: "Business", sent: -0.67, urg: 0.85, text: "hitting rate limits on @cf/meta/llama-3.1-8b constantly. 429 errors have no Retry-After header. how do you implement backoff correctly?" },
      { source: "github", author: "priya-dev", tier: "Pro", sent: -0.55, urg: 0.74, text: "AI binding rate limit not documented clearly. Error says 'rate limit exceeded' but docs don't say what the limit is or when it resets." },
      { source: "forum", author: "synth_labs", tier: "Business", sent: -0.61, urg: 0.79, text: "Workers AI rate limits make it impossible to build production apps. Switched back to OpenAI until there's a paid tier with real limits." },
    ],
  },
  {
    id: `sig-pages-build-${ts}`,
    product: "Cloudflare Pages",
    theme: "Build Failures",
    criticality: "high",
    trend: "spiking",
    evidence: "Build timeout failures spiking for monorepo deployments. 20-minute hard limit causes failures for Next.js and NX workspaces. 31 unique teams blocked this week.",
    prev_sentiment: -0.20,
    curr_sentiment: -0.58,
    pull_quote: "We have a 200-package monorepo and Pages times out every single build. Our team has been blocked for 3 weeks.",
    suggested_action: "Increase Pages build timeout to 45 min for paid plans, add persistent build cache for popular frameworks (Next.js, Astro, Remix), and stream live build logs.",
    item_count: 11,
    enterprise_count: 3,
    // score = 11×0.85×2.0×1.0×0.90 ≈ 16.8
    volume: 11, urgency: 0.85, source_weight_avg: 2.0, theme_boost: 1.0, recency: 0.90, sentiment_delta: -0.38,
    items: [
      { source: "support", author: "Rachel K.", tier: "Enterprise", sent: -0.74, urg: 0.88, text: "Pages build cache not persisting between deploys for our NX monorepo. Every build reinstalls 800 MB of deps. 20 min timeout kills us." },
      { source: "discord", author: "webdev_max", tier: "Pro", sent: -0.62, urg: 0.80, text: "Pages build timeout at 20 min is brutal for monorepos. Vercel gives 45 min. Considering switching if this isn't fixed." },
      { source: "github", author: "jsmonorepo", tier: "Business", sent: -0.48, urg: 0.71, text: "Deploy hooks not firing reliably on large commits (200+ files changed). 3 failed deployments this week with no notification." },
      { source: "twitter", author: "@cf_pages_user", tier: "Pro", sent: -0.45, urg: 0.65, text: "Pages is great until you have a real-world project. Build limits and no incremental builds make it unusable for large apps." },
    ],
  },
  {
    id: `sig-zt-posture-${ts}`,
    product: "Zero Trust",
    theme: "Device Posture",
    criticality: "medium",
    trend: "steady",
    evidence: "Device posture checks failing inconsistently on Apple Silicon Macs after macOS Sequoia update. WARP not recognising MDM-enrolled status on ~12 % of M3 MacBook fleet.",
    prev_sentiment: -0.25,
    curr_sentiment: -0.44,
    pull_quote: "After the macOS update, 15 of our 120 engineers can't access internal apps because WARP thinks their machines are unmanaged.",
    suggested_action: "Release WARP patch for macOS Sequoia device posture compatibility, add grace period for MDM sync delays, and improve error messaging on failed posture checks.",
    item_count: 8,
    enterprise_count: 4,
    // score = 8×0.74×2.3×1.0×0.82 ≈ 11.2
    volume: 8, urgency: 0.74, source_weight_avg: 2.3, theme_boost: 1.0, recency: 0.82, sentiment_delta: -0.19,
    items: [
      { source: "support", author: "IT Admin Corp", tier: "Enterprise", sent: -0.71, urg: 0.82, text: "After macOS Sequoia 15.2 update, WARP device posture fails on M3 Macs. MDM enrollment not recognised. 15 engineers locked out of internal apps." },
      { source: "support", author: "SecOps Team", tier: "Enterprise", sent: -0.65, urg: 0.76, text: "Device posture policies not syncing after Jamf policy push. WARP shows device as unmanaged despite active MDM enrollment." },
      { source: "forum", author: "zt_admin", tier: "Business", sent: -0.38, urg: 0.61, text: "Zero Trust device posture checks are too brittle. Any OS update and we manually re-enroll half the fleet. Needs a grace period." },
      { source: "discord", author: "cloudflare_it", tier: "Business", sent: -0.29, urg: 0.57, text: "WARP + device posture + SAML is a painful combo. Docs don't cover the case where SAML session expires during posture check." },
    ],
  },
  {
    id: `sig-r2-egress-${ts}`,
    product: "R2 Storage",
    theme: "Egress Pricing",
    criticality: "medium",
    trend: "steady",
    evidence: "R2 praised for zero egress to Cloudflare network but external egress cost surprises users migrating from S3. CORS configuration complexity also a recurring theme in support.",
    prev_sentiment: 0.10,
    curr_sentiment: -0.15,
    pull_quote: "R2 is 80 % cheaper than S3 for egress within Cloudflare but I still get surprised bills when pulling to on-prem.",
    suggested_action: "Add R2 cost calculator with per-operation breakdown, ship a visual CORS config editor, and publish a realistic S3→R2 migration cost guide.",
    item_count: 7,
    enterprise_count: 2,
    // score = 7×0.61×1.4×1.0×0.84 ≈ 5.0
    volume: 7, urgency: 0.61, source_weight_avg: 1.4, theme_boost: 1.0, recency: 0.84, sentiment_delta: -0.25,
    items: [
      { source: "forum", author: "storage_nerd", tier: "Business", sent: -0.31, urg: 0.55, text: "R2 egress from CF network is free — amazing. But pulling data to on-prem for backups still costs real money. Wish there were a cheaper cold-pull tier." },
      { source: "discord", author: "r2_migrant", tier: "Pro", sent: 0.12, urg: 0.48, text: "Migrated 50 TB from S3 to R2. Zero egress to Workers is killer. CORS config is still painful though — took 2 h to get right." },
      { source: "twitter", author: "@indie_builder", tier: "Free", sent: -0.22, urg: 0.43, text: "R2 free tier is generous but I got a surprise bill because external egress pricing wasn't clearly shown before I migrated." },
    ],
  },
  {
    id: `sig-stream-apac-${ts}`,
    product: "Stream",
    theme: "APAC Latency",
    criticality: "low",
    trend: "declining",
    evidence: "Live streaming latency in Southeast Asia reported at 8-12 s versus competitor 3-4 s benchmarks. Limited edge capacity at Singapore and Jakarta PoPs.",
    prev_sentiment: -0.40,
    curr_sentiment: -0.28,
    pull_quote: "Our viewers in Singapore get 10 s latency on live sports. They are switching to a competitor with 3 s latency.",
    suggested_action: "Expand Stream edge capacity in APAC (SIN, CGK, BOM), add LLHLS support for sub-5 s live latency, and surface regional latency SLAs in the Stream dashboard.",
    item_count: 5,
    enterprise_count: 1,
    // score = 5×0.54×1.1×1.0×0.71 ≈ 2.1
    volume: 5, urgency: 0.54, source_weight_avg: 1.1, theme_boost: 1.0, recency: 0.71, sentiment_delta: 0.12,
    items: [
      { source: "discord", author: "apac_streamer", tier: "Business", sent: -0.55, urg: 0.62, text: "Stream live latency in Southeast Asia is 8-12 s. Competitors are at 3-4 s in the same region. Losing viewers." },
      { source: "forum", author: "media_startup", tier: "Pro", sent: -0.33, urg: 0.51, text: "Stream adaptive bitrate struggles on mobile in Indonesia — keeps dropping to 240p even on 4G. Buffer ratio is terrible." },
      { source: "twitter", author: "@stream_dev", tier: "Pro", sent: -0.28, urg: 0.44, text: "Stream webhooks for live.end events are missing ~20 % of the time. Makes post-processing unreliable." },
    ],
  },
]

// Compute scores
for (const sig of SIGNALS) {
  sig.score = sig.volume * sig.urgency * sig.source_weight_avg * sig.theme_boost * sig.recency
}

console.log("\nInserting signals and enrichment items…")

for (const sig of SIGNALS) {
  // Insert enrichment items
  const itemIds = []
  for (const item of sig.items) {
    const itemId = `e-new-${ts}-${Math.random().toString(36).slice(2, 8)}`
    itemIds.push(itemId)
    const sentLabel = item.sent < -0.1 ? "negative" : item.sent > 0.1 ? "positive" : "neutral"
    await q(
      `INSERT INTO enrichment (id, source, snippet, author, customer_tier, timestamp_iso, sentiment, sentiment_score, urgency_score, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, item.source, item.text, item.author, item.tier, now, sentLabel, item.sent, item.urg, now]
    )
  }

  // Insert signal
  await q(
    `INSERT INTO signals (id, product, theme, criticality, trend, evidence, previous_sentiment, current_sentiment, pull_quote, suggested_action, item_count, enterprise_count, is_dismissed, on_roadmap, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [sig.id, sig.product, sig.theme, sig.criticality, sig.trend, sig.evidence, sig.prev_sentiment, sig.curr_sentiment, sig.pull_quote, sig.suggested_action, sig.item_count, sig.enterprise_count, now, now]
  )

  // Link items to signal
  for (const itemId of itemIds) {
    await q(`INSERT INTO signal_items (signal_id, item_id) VALUES (?, ?)`, [sig.id, itemId])
  }

  // Insert score breakdown
  await q(
    `INSERT INTO score_breakdowns (signal_id, volume, urgency, source_weight_avg, theme_boost, recency, sentiment_delta, score, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sig.id, sig.volume, sig.urgency, sig.source_weight_avg, sig.theme_boost, sig.recency, sig.sentiment_delta, sig.score, now]
  )

  // Link to current brief (rank placeholder — will be fixed by re-rank below)
  await q(
    `INSERT INTO brief_signals (brief_id, signal_id, rank) VALUES (?, ?, 99)`,
    [briefId, sig.id]
  )

  console.log(`  ✓ ${sig.product} / ${sig.theme}  score=${sig.score.toFixed(2)}`)
}

// Re-rank all brief signals by score
console.log("\nRe-ranking all signals by score…")
const allScores = await q(
  `SELECT bs.signal_id, sb.score
   FROM brief_signals bs
   JOIN score_breakdowns sb ON sb.signal_id = bs.signal_id
   JOIN signals s ON s.id = bs.signal_id
   WHERE bs.brief_id = ? AND s.is_dismissed = 0
   ORDER BY sb.score DESC`,
  [briefId]
)

for (let i = 0; i < allScores.length; i++) {
  await q(
    "UPDATE brief_signals SET rank = ? WHERE brief_id = ? AND signal_id = ?",
    [i + 1, briefId, allScores[i].signal_id]
  )
}

console.log(`\n✅ Done — ${allScores.length} signals ranked:`)
allScores.forEach((r, i) => console.log(`  ${i + 1}. ${r.signal_id}  (${r.score.toFixed(2)})`))
