-- ProductSense D1 Schema
-- Migration: 0001_initial_schema

-- Raw enriched feedback items (output of Workers AI enrichment step)
-- Named "enrichment" to match the SQL Playground's default query
CREATE TABLE IF NOT EXISTS enrichment (
  id              TEXT    PRIMARY KEY,
  source          TEXT    NOT NULL CHECK (source IN ('discord','github','support','twitter','forum')),
  snippet         TEXT    NOT NULL,
  author          TEXT    NOT NULL,
  customer_tier   TEXT    NOT NULL CHECK (customer_tier IN ('Free','Pro','Business','Enterprise')),
  timestamp_iso   TEXT    NOT NULL,      -- ISO 8601; enables date-range queries
  sentiment       TEXT    CHECK (sentiment IN ('negative','neutral','positive')),
  sentiment_score REAL,                  -- -1.0 to 1.0 from llama-3.1-8b-instruct
  urgency_score   REAL,                  -- 0.0 to 1.0 from Workers AI
  url             TEXT,
  vector_id       TEXT,                  -- Vectorize namespace ID for the bge-small-en-v1.5 embedding
  raw_text        TEXT,                  -- full original text before snippet truncation
  ingested_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Clustered, enriched signal groups (output of Vectorize KNN clustering step)
CREATE TABLE IF NOT EXISTS signals (
  id                  TEXT    PRIMARY KEY,
  product             TEXT    NOT NULL,
  theme               TEXT    NOT NULL,
  criticality         TEXT    NOT NULL CHECK (criticality IN ('high','medium','low')),
  trend               TEXT    NOT NULL CHECK (trend IN ('spiking','steady','declining')),
  evidence            TEXT    NOT NULL,  -- AI-generated summary sentence
  previous_sentiment  REAL,
  current_sentiment   REAL,
  pull_quote          TEXT,              -- representative verbatim quote
  suggested_action    TEXT,             -- AI-generated PM recommendation
  item_count          INTEGER NOT NULL DEFAULT 0,
  enterprise_count    INTEGER NOT NULL DEFAULT 0,
  is_dismissed        INTEGER NOT NULL DEFAULT 0,  -- 1 = PM dismissed via Reject button
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Per-signal scoring metadata (1:1 with signals, stored separately to keep signals lean)
CREATE TABLE IF NOT EXISTS score_breakdowns (
  signal_id         TEXT    PRIMARY KEY REFERENCES signals(id) ON DELETE CASCADE,
  volume            INTEGER NOT NULL,
  urgency           REAL    NOT NULL,
  source_weight_avg REAL    NOT NULL,
  theme_boost       REAL    NOT NULL,
  recency           REAL    NOT NULL,
  sentiment_delta   REAL    NOT NULL,
  score             REAL    NOT NULL,
  computed_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many between signals and enrichment items
CREATE TABLE IF NOT EXISTS signal_items (
  signal_id TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL REFERENCES enrichment(id) ON DELETE CASCADE,
  PRIMARY KEY (signal_id, item_id)
);

-- Materialized Vectorize KNN similarity relationships between signals
-- Written after the cluster step; lets the UI query related signals without Vectorize round-trips
CREATE TABLE IF NOT EXISTS signal_edges (
  source_id        TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  target_id        TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  similarity_score REAL NOT NULL,  -- cosine similarity 0.0-1.0
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_id, target_id)
);

-- Historical audit trail of generated briefs
-- Current brief is also cached in KV as "brief:latest" for instant edge reads
CREATE TABLE IF NOT EXISTS briefs (
  id           TEXT PRIMARY KEY,
  headline     TEXT NOT NULL,
  summary      TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  kv_key       TEXT,  -- KV cache key, e.g. "brief:latest"
  policy_id    TEXT REFERENCES weighting_policies(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ordered list of signals included in each brief (rank 1 = highest priority)
CREATE TABLE IF NOT EXISTS brief_signals (
  brief_id  TEXT    NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  signal_id TEXT    NOT NULL REFERENCES signals(id),
  rank      INTEGER NOT NULL,
  PRIMARY KEY (brief_id, signal_id)
);

-- PM-defined source weights, theme boosts, and scoring parameters
-- Exactly one row should have is_active = 1 at any time
CREATE TABLE IF NOT EXISTS weighting_policies (
  id                  TEXT    PRIMARY KEY,
  name                TEXT    NOT NULL DEFAULT 'Default',
  source_weights      TEXT    NOT NULL,  -- JSON: {"discord":1.0,"github":1.5,"support":3.0,"twitter":0.5,"forum":1.0}
  theme_boosts        TEXT    NOT NULL,  -- JSON array: ["Reliability","Bugs"]
  recency_half_life   INTEGER NOT NULL DEFAULT 24,
  sentiment_threshold REAL    NOT NULL DEFAULT -0.2,
  is_active           INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- enrichment: hot paths for the SQL Playground and ingestion dedup
CREATE INDEX IF NOT EXISTS idx_enrichment_source    ON enrichment(source);
CREATE INDEX IF NOT EXISTS idx_enrichment_tier      ON enrichment(customer_tier);
CREATE INDEX IF NOT EXISTS idx_enrichment_sentiment ON enrichment(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_enrichment_urgency   ON enrichment(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_ingested  ON enrichment(ingested_at DESC);

-- signals: product/theme filtering and time-range queries
CREATE INDEX IF NOT EXISTS idx_signals_product     ON signals(product);
CREATE INDEX IF NOT EXISTS idx_signals_theme       ON signals(theme);
CREATE INDEX IF NOT EXISTS idx_signals_criticality ON signals(criticality);
CREATE INDEX IF NOT EXISTS idx_signals_created     ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_dismissed   ON signals(is_dismissed);

-- junction tables
CREATE INDEX IF NOT EXISTS idx_signal_items_signal ON signal_items(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_items_item   ON signal_items(item_id);
CREATE INDEX IF NOT EXISTS idx_signal_edges_source ON signal_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_brief_signals_brief ON brief_signals(brief_id);
CREATE INDEX IF NOT EXISTS idx_brief_signals_rank  ON brief_signals(brief_id, rank);

-- active policy fast lookup
CREATE INDEX IF NOT EXISTS idx_policies_active ON weighting_policies(is_active);
