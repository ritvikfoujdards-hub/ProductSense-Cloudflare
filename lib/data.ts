// All mock data has been removed — data is served live from D1 via /api/* routes.

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

// Used by WeightsPanel UI for the theme boost checkbox list
export const themes = ["Performance", "Reliability", "Pricing", "DX", "Bugs"]
