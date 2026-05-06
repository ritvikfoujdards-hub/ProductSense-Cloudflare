export type Trend = "spiking" | "steady" | "declining"
export type Criticality = "high" | "medium" | "low"
export type Sentiment = "negative" | "neutral" | "positive"
export type Source = "discord" | "github" | "support" | "twitter" | "forum"

export interface DashboardMetrics {
  sentimentScore: number
  sentimentChange: number
  feedbackVolume24h: number
  volumeChange: number
  topTheme: string
  themeCount: number
  pipelineStatus: "healthy" | "degraded" | "offline"
  lastProcessed: string
}

export interface ScoreBreakdown {
  volume: number
  urgency: number
  sourceWeightAvg: number
  themeBoost: number
  recency: number
  sentimentDelta: number
  score: number
}

export interface FeedbackItem {
  id: string
  source: Source
  snippet: string
  author: string
  customerTier: "Free" | "Pro" | "Business" | "Enterprise"
  timestamp: string
  sentiment: Sentiment
  url?: string
}

export interface Signal {
  id: string
  number: number
  trend: Trend
  criticality: Criticality
  product: string
  theme: string
  evidence: string
  previousSentiment: number
  currentSentiment: number
  pullQuote: string
  suggestedAction: string
  itemCount: number
  enterpriseCount: number
  scoreBreakdown: ScoreBreakdown
  items: FeedbackItem[]
}

export interface Brief {
  headline: string
  summary: string
  generatedAt: string
  signals: Signal[]
}

export interface Weights {
  sources: {
    discord: number
    github: number
    support: number
    twitter: number
    forum: number
  }
  themeBoosts: string[]
  recencyHalfLife: number
  sentimentThreshold: number
}

export const defaultWeights: Weights = {
  sources: {
    discord: 1.0,
    github: 1.5,
    support: 3.0,
    twitter: 0.5,
    forum: 1.0,
  },
  themeBoosts: ["Reliability", "Bugs"],
  recencyHalfLife: 24,
  sentimentThreshold: -0.2,
}

export const mockBrief: Brief = {
  headline: "Workers AI rate-limit errors are spiking among enterprise customers.",
  summary:
    "Three signals worth your attention this morning. Volume is up 34% week-over-week, and sentiment on Workers AI billing has slipped meaningfully since Friday's pricing update. One emerging theme around D1 local-dev ergonomics is worth watching but not yet acting on.",
  generatedAt: "7:02 AM",
  signals: [
    {
      id: "signal-1",
      number: 1,
      trend: "spiking",
      criticality: "high",
      product: "Workers AI",
      theme: "Reliability",
      evidence: "12 customers, 3 enterprise. Sentiment −0.6 (was −0.2).",
      previousSentiment: -0.2,
      currentSentiment: -0.6,
      pullQuote:
        "We're hitting 429s on Workers AI consistently and there's no clear path to raise limits without going through sales. Blocking our launch.",
      suggestedAction: "Ship a self-serve limit-raise flow for paying customers this week.",
      itemCount: 12,
      enterpriseCount: 3,
      scoreBreakdown: {
        volume: 12,
        urgency: 0.81,
        sourceWeightAvg: 2.1,
        themeBoost: 1.5,
        recency: 0.94,
        sentimentDelta: -0.4,
        score: 14.3,
      },
      items: [
        {
          id: "item-1",
          source: "discord",
          snippet: "anyone else getting 429 on workers AI? second time this week",
          author: "@devops_dan",
          customerTier: "Pro",
          timestamp: "2h ago",
          sentiment: "negative",
        },
        {
          id: "item-2",
          source: "support",
          snippet:
            "Production incident: model invocations failing with 429. Need limit raised urgently.",
          author: "Acme Corp",
          customerTier: "Enterprise",
          timestamp: "4h ago",
          sentiment: "negative",
        },
        {
          id: "item-3",
          source: "github",
          snippet:
            "Feature request: programmatic API to view current rate limit utilization and request increase",
          author: "github.com/.../issues/2341",
          customerTier: "Pro",
          timestamp: "6h ago",
          sentiment: "neutral",
        },
        {
          id: "item-4",
          source: "twitter",
          snippet: "Cloudflare Workers AI rate limits are unhinged for the price",
          author: "@startupcto",
          customerTier: "Pro",
          timestamp: "8h ago",
          sentiment: "negative",
        },
        {
          id: "item-5",
          source: "discord",
          snippet:
            "is there a way to see how close I am to my Workers AI quota? keep getting surprised by 429s",
          author: "@ml_engineer",
          customerTier: "Pro",
          timestamp: "12h ago",
          sentiment: "negative",
        },
        {
          id: "item-6",
          source: "support",
          snippet: "Urgent: Workers AI returning 429 errors during peak traffic. Enterprise SLA affected.",
          author: "TechFlow Inc",
          customerTier: "Enterprise",
          timestamp: "14h ago",
          sentiment: "negative",
        },
        {
          id: "item-7",
          source: "forum",
          snippet: "Has anyone found a workaround for Workers AI rate limits? Need to batch requests somehow.",
          author: "developer_jane",
          customerTier: "Pro",
          timestamp: "16h ago",
          sentiment: "negative",
        },
        {
          id: "item-8",
          source: "github",
          snippet: "Bug: Rate limit headers not returned in 429 response, impossible to implement backoff",
          author: "github.com/.../issues/2356",
          customerTier: "Business",
          timestamp: "18h ago",
          sentiment: "negative",
        },
        {
          id: "item-9",
          source: "discord",
          snippet: "Just got our third 429 this morning. Switching to OpenAI if this continues.",
          author: "@frustrated_dev",
          customerTier: "Pro",
          timestamp: "20h ago",
          sentiment: "negative",
        },
        {
          id: "item-10",
          source: "support",
          snippet: "Enterprise customer requesting emergency limit increase for product launch tomorrow.",
          author: "DataScale Corp",
          customerTier: "Enterprise",
          timestamp: "22h ago",
          sentiment: "negative",
        },
        {
          id: "item-11",
          source: "twitter",
          snippet: "Workers AI is great when it works, but the rate limiting is killing our UX",
          author: "@aibuilder",
          customerTier: "Pro",
          timestamp: "23h ago",
          sentiment: "negative",
        },
        {
          id: "item-12",
          source: "forum",
          snippet: "Documentation unclear on how rate limits are calculated. Per-account or per-worker?",
          author: "cloudflare_user",
          customerTier: "Free",
          timestamp: "24h ago",
          sentiment: "neutral",
        },
      ],
    },
    {
      id: "signal-2",
      number: 2,
      trend: "steady",
      criticality: "medium",
      product: "D1",
      theme: "DX",
      evidence: "8 customers, mostly Pro tier. Sentiment −0.3 (was −0.3).",
      previousSentiment: -0.3,
      currentSentiment: -0.3,
      pullQuote:
        "Local D1 dev with `wrangler dev` randomly drops migrations. I've reset my local DB four times this week.",
      suggestedAction:
        "Investigate `wrangler d1` local-state corruption; reproducible repro likely in <30min.",
      itemCount: 8,
      enterpriseCount: 0,
      scoreBreakdown: {
        volume: 8,
        urgency: 0.55,
        sourceWeightAvg: 1.4,
        themeBoost: 1.0,
        recency: 0.88,
        sentimentDelta: 0.0,
        score: 5.4,
      },
      items: [
        {
          id: "item-d1-1",
          source: "discord",
          snippet: "wrangler d1 migrations getting lost after restart, anyone else?",
          author: "@backend_bob",
          customerTier: "Pro",
          timestamp: "3h ago",
          sentiment: "negative",
        },
        {
          id: "item-d1-2",
          source: "github",
          snippet: "Bug: D1 local database state inconsistent after wrangler restart",
          author: "github.com/.../issues/4521",
          customerTier: "Pro",
          timestamp: "5h ago",
          sentiment: "negative",
        },
        {
          id: "item-d1-3",
          source: "forum",
          snippet: "D1 local dev workflow is frustrating. Have to recreate my test data constantly.",
          author: "fullstack_dev",
          customerTier: "Pro",
          timestamp: "8h ago",
          sentiment: "negative",
        },
        {
          id: "item-d1-4",
          source: "discord",
          snippet: "Is there a persistent local D1 mode? Losing data between sessions",
          author: "@newbie_coder",
          customerTier: "Free",
          timestamp: "10h ago",
          sentiment: "neutral",
        },
        {
          id: "item-d1-5",
          source: "twitter",
          snippet: "D1 is promising but local dev story needs work. #cloudflare",
          author: "@webdev_sarah",
          customerTier: "Pro",
          timestamp: "14h ago",
          sentiment: "neutral",
        },
        {
          id: "item-d1-6",
          source: "github",
          snippet: "Feature request: persistent D1 local storage option for development",
          author: "github.com/.../issues/4530",
          customerTier: "Pro",
          timestamp: "18h ago",
          sentiment: "neutral",
        },
        {
          id: "item-d1-7",
          source: "forum",
          snippet: "Tips for D1 local dev? My migrations keep disappearing randomly",
          author: "db_enthusiast",
          customerTier: "Pro",
          timestamp: "20h ago",
          sentiment: "negative",
        },
        {
          id: "item-d1-8",
          source: "discord",
          snippet: "D1 remote works fine but local is buggy. Switched to remote for dev too.",
          author: "@pragmatic_eng",
          customerTier: "Business",
          timestamp: "22h ago",
          sentiment: "negative",
        },
      ],
    },
    {
      id: "signal-3",
      number: 3,
      trend: "declining",
      criticality: "low",
      product: "R2",
      theme: "Pricing",
      evidence: "6 customers, mixed tiers. Sentiment −0.1 (was −0.5).",
      previousSentiment: -0.5,
      currentSentiment: -0.1,
      pullQuote:
        "R2 egress pricing finally makes sense after the doc update. Moved 2TB from S3 last week.",
      suggestedAction:
        "No action needed; document the messaging that worked for future pricing changes.",
      itemCount: 6,
      enterpriseCount: 1,
      scoreBreakdown: {
        volume: 6,
        urgency: 0.22,
        sourceWeightAvg: 1.3,
        themeBoost: 1.0,
        recency: 0.76,
        sentimentDelta: 0.4,
        score: 1.6,
      },
      items: [
        {
          id: "item-r2-1",
          source: "twitter",
          snippet: "R2 pricing page update is much clearer now. Finally pulled the trigger on migration.",
          author: "@cloud_migrator",
          customerTier: "Pro",
          timestamp: "6h ago",
          sentiment: "positive",
        },
        {
          id: "item-r2-2",
          source: "forum",
          snippet: "Moved 500GB to R2 after the pricing clarification. Zero egress fees is real.",
          author: "storage_guru",
          customerTier: "Business",
          timestamp: "12h ago",
          sentiment: "positive",
        },
        {
          id: "item-r2-3",
          source: "discord",
          snippet: "R2 docs now make sense. Wish all cloud pricing was this transparent.",
          author: "@devops_lead",
          customerTier: "Enterprise",
          timestamp: "15h ago",
          sentiment: "positive",
        },
        {
          id: "item-r2-4",
          source: "github",
          snippet: "Updated R2 example costs in our infra docs, pricing is much more competitive now",
          author: "github.com/.../commit/abc123",
          customerTier: "Pro",
          timestamp: "18h ago",
          sentiment: "positive",
        },
        {
          id: "item-r2-5",
          source: "twitter",
          snippet: "R2 egress pricing finally makes sense after the doc update. Moved 2TB from S3 last week.",
          author: "@startup_cfo",
          customerTier: "Pro",
          timestamp: "20h ago",
          sentiment: "positive",
        },
        {
          id: "item-r2-6",
          source: "forum",
          snippet: "Still a bit confused on R2 vs S3 for large files but getting there",
          author: "storage_newbie",
          customerTier: "Free",
          timestamp: "23h ago",
          sentiment: "neutral",
        },
      ],
    },
  ],
}

// Alternative brief when weights are changed (support weight lowered)
export const altMockBrief: Brief = {
  headline: "D1 local development friction is a consistent pain point across Pro users.",
  summary:
    "With support tickets weighted lower, developer experience signals from community channels rise. D1's local dev workflow is the top friction point today. Workers AI rate limits remain a concern but with fewer enterprise escalations surfaced.",
  generatedAt: "7:02 AM",
  signals: [
    {
      id: "signal-2",
      number: 1,
      trend: "steady",
      criticality: "medium",
      product: "D1",
      theme: "DX",
      evidence: "8 customers, mostly Pro tier. Sentiment −0.3 (was −0.3).",
      previousSentiment: -0.3,
      currentSentiment: -0.3,
      pullQuote:
        "Local D1 dev with `wrangler dev` randomly drops migrations. I've reset my local DB four times this week.",
      suggestedAction:
        "Investigate `wrangler d1` local-state corruption; reproducible repro likely in <30min.",
      itemCount: 8,
      enterpriseCount: 0,
      scoreBreakdown: {
        volume: 8,
        urgency: 0.55,
        sourceWeightAvg: 1.4,
        themeBoost: 1.0,
        recency: 0.88,
        sentimentDelta: 0.0,
        score: 5.4,
      },
      items: mockBrief.signals[1].items,
    },
    {
      id: "signal-1",
      number: 2,
      trend: "spiking",
      criticality: "high",
      product: "Workers AI",
      theme: "Reliability",
      evidence: "12 customers, 3 enterprise. Sentiment −0.6 (was −0.2).",
      previousSentiment: -0.2,
      currentSentiment: -0.6,
      pullQuote:
        "We're hitting 429s on Workers AI consistently and there's no clear path to raise limits without going through sales. Blocking our launch.",
      suggestedAction: "Ship a self-serve limit-raise flow for paying customers this week.",
      itemCount: 12,
      enterpriseCount: 3,
      scoreBreakdown: {
        volume: 12,
        urgency: 0.81,
        sourceWeightAvg: 1.2,
        themeBoost: 1.5,
        recency: 0.94,
        sentimentDelta: -0.4,
        score: 9.8,
      },
      items: mockBrief.signals[0].items,
    },
    {
      id: "signal-3",
      number: 3,
      trend: "declining",
      criticality: "low",
      product: "R2",
      theme: "Pricing",
      evidence: "6 customers, mixed tiers. Sentiment −0.1 (was −0.5).",
      previousSentiment: -0.5,
      currentSentiment: -0.1,
      pullQuote:
        "R2 egress pricing finally makes sense after the doc update. Moved 2TB from S3 last week.",
      suggestedAction:
        "No action needed; document the messaging that worked for future pricing changes.",
      itemCount: 6,
      enterpriseCount: 1,
      scoreBreakdown: {
        volume: 6,
        urgency: 0.22,
        sourceWeightAvg: 1.3,
        themeBoost: 1.0,
        recency: 0.76,
        sentimentDelta: 0.4,
        score: 1.6,
      },
      items: mockBrief.signals[2].items,
    },
  ],
}

export const themes = ["Performance", "Reliability", "Pricing", "DX", "Bugs"]

export const mockDashboardMetrics: DashboardMetrics = {
  sentimentScore: -0.34,
  sentimentChange: -12,
  feedbackVolume24h: 847,
  volumeChange: 34,
  topTheme: "Reliability",
  themeCount: 23,
  pipelineStatus: "healthy",
  lastProcessed: "2 min ago",
}
