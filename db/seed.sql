-- ProductSense D1 Seed Data
-- Mirrors the mock data from lib/data.ts for local development

-- ── Weighting Policy ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO weighting_policies (id, name, source_weights, theme_boosts, recency_half_life, sentiment_threshold, is_active)
VALUES (
  'policy-default',
  'Default',
  '{"discord":1.0,"github":1.5,"support":3.0,"twitter":0.5,"forum":1.0}',
  '["Reliability","Bugs"]',
  24,
  -0.2,
  1
);

-- ── Signals ──────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO signals (id, product, theme, criticality, trend, evidence, previous_sentiment, current_sentiment, pull_quote, suggested_action, item_count, enterprise_count)
VALUES
  (
    'signal-1',
    'Workers AI',
    'Reliability',
    'high',
    'spiking',
    '12 customers, 3 enterprise. Sentiment −0.6 (was −0.2).',
    -0.2, -0.6,
    'We''re hitting 429s on Workers AI consistently and there''s no clear path to raise limits without going through sales. Blocking our launch.',
    'Ship a self-serve limit-raise flow for paying customers this week.',
    12, 3
  ),
  (
    'signal-2',
    'D1',
    'DX',
    'medium',
    'steady',
    '8 customers, mostly Pro tier. Sentiment −0.3 (was −0.3).',
    -0.3, -0.3,
    'Local D1 dev with `wrangler dev` randomly drops migrations. I''ve reset my local DB four times this week.',
    'Investigate `wrangler d1` local-state corruption; reproducible repro likely in <30min.',
    8, 0
  ),
  (
    'signal-3',
    'R2',
    'Pricing',
    'low',
    'declining',
    '6 customers, mixed tiers. Sentiment −0.1 (was −0.5).',
    -0.5, -0.1,
    'R2 egress pricing finally makes sense after the doc update. Moved 2TB from S3 last week.',
    'No action needed; document the messaging that worked for future pricing changes.',
    6, 1
  );

-- ── Score Breakdowns ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO score_breakdowns (signal_id, volume, urgency, source_weight_avg, theme_boost, recency, sentiment_delta, score)
VALUES
  ('signal-1', 12, 0.81, 2.1, 1.5, 0.94, -0.4, 14.3),
  ('signal-2',  8, 0.55, 1.4, 1.0, 0.88,  0.0,  5.4),
  ('signal-3',  6, 0.22, 1.3, 1.0, 0.76,  0.4,  1.6);

-- ── Enrichment Items ─────────────────────────────────────────────────────────
-- Signal 1: Workers AI rate limits (12 items)

INSERT OR IGNORE INTO enrichment (id, source, snippet, author, customer_tier, timestamp_iso, sentiment, sentiment_score, urgency_score)
VALUES
  ('item-1',  'discord', 'anyone else getting 429 on workers AI? second time this week',                                          '@devops_dan',              'Pro',        '2025-05-06T05:00:00Z', 'negative', -0.80, 0.70),
  ('item-2',  'support', 'Production incident: model invocations failing with 429. Need limit raised urgently.',                  'Acme Corp',                'Enterprise', '2025-05-06T03:00:00Z', 'negative', -0.90, 0.95),
  ('item-3',  'github',  'Feature request: programmatic API to view current rate limit utilization and request increase',         'github.com/.../issues/2341','Pro',        '2025-05-06T01:00:00Z', 'neutral',  -0.05, 0.60),
  ('item-4',  'twitter', 'Cloudflare Workers AI rate limits are unhinged for the price',                                          '@startupcto',              'Pro',        '2025-05-05T23:00:00Z', 'negative', -0.70, 0.60),
  ('item-5',  'discord', 'is there a way to see how close I am to my Workers AI quota? keep getting surprised by 429s',           '@ml_engineer',             'Pro',        '2025-05-05T19:00:00Z', 'negative', -0.60, 0.50),
  ('item-6',  'support', 'Urgent: Workers AI returning 429 errors during peak traffic. Enterprise SLA affected.',                 'TechFlow Inc',             'Enterprise', '2025-05-05T17:00:00Z', 'negative', -0.95, 0.98),
  ('item-7',  'forum',   'Has anyone found a workaround for Workers AI rate limits? Need to batch requests somehow.',             'developer_jane',           'Pro',        '2025-05-05T15:00:00Z', 'negative', -0.50, 0.40),
  ('item-8',  'github',  'Bug: Rate limit headers not returned in 429 response, impossible to implement backoff',                 'github.com/.../issues/2356','Business',  '2025-05-05T13:00:00Z', 'negative', -0.70, 0.75),
  ('item-9',  'discord', 'Just got our third 429 this morning. Switching to OpenAI if this continues.',                           '@frustrated_dev',          'Pro',        '2025-05-05T11:00:00Z', 'negative', -0.80, 0.65),
  ('item-10', 'support', 'Enterprise customer requesting emergency limit increase for product launch tomorrow.',                   'DataScale Corp',           'Enterprise', '2025-05-05T09:00:00Z', 'negative', -0.90, 0.90),
  ('item-11', 'twitter', 'Workers AI is great when it works, but the rate limiting is killing our UX',                            '@aibuilder',               'Pro',        '2025-05-05T08:00:00Z', 'negative', -0.60, 0.50),
  ('item-12', 'forum',   'Documentation unclear on how rate limits are calculated. Per-account or per-worker?',                   'cloudflare_user',          'Free',       '2025-05-05T07:00:00Z', 'neutral',  -0.10, 0.30);

-- Signal 2: D1 local dev (8 items)

INSERT OR IGNORE INTO enrichment (id, source, snippet, author, customer_tier, timestamp_iso, sentiment, sentiment_score, urgency_score)
VALUES
  ('item-d1-1', 'discord', 'wrangler d1 migrations getting lost after restart, anyone else?',                       '@backend_bob',              'Pro',      '2025-05-06T04:00:00Z', 'negative', -0.60, 0.50),
  ('item-d1-2', 'github',  'Bug: D1 local database state inconsistent after wrangler restart',                      'github.com/.../issues/4521', 'Pro',      '2025-05-06T02:00:00Z', 'negative', -0.70, 0.60),
  ('item-d1-3', 'forum',   'D1 local dev workflow is frustrating. Have to recreate my test data constantly.',       'fullstack_dev',             'Pro',      '2025-05-05T23:00:00Z', 'negative', -0.50, 0.40),
  ('item-d1-4', 'discord', 'Is there a persistent local D1 mode? Losing data between sessions',                     '@newbie_coder',             'Free',     '2025-05-05T21:00:00Z', 'neutral',  -0.10, 0.20),
  ('item-d1-5', 'twitter', 'D1 is promising but local dev story needs work. #cloudflare',                          '@webdev_sarah',             'Pro',      '2025-05-05T17:00:00Z', 'neutral',  -0.20, 0.30),
  ('item-d1-6', 'github',  'Feature request: persistent D1 local storage option for development',                  'github.com/.../issues/4530', 'Pro',      '2025-05-05T13:00:00Z', 'neutral',  -0.10, 0.25),
  ('item-d1-7', 'forum',   'Tips for D1 local dev? My migrations keep disappearing randomly',                      'db_enthusiast',             'Pro',      '2025-05-05T11:00:00Z', 'negative', -0.50, 0.45),
  ('item-d1-8', 'discord', 'D1 remote works fine but local is buggy. Switched to remote for dev too.',             '@pragmatic_eng',            'Business', '2025-05-05T09:00:00Z', 'negative', -0.60, 0.50);

-- Signal 3: R2 pricing (6 items)

INSERT OR IGNORE INTO enrichment (id, source, snippet, author, customer_tier, timestamp_iso, sentiment, sentiment_score, urgency_score)
VALUES
  ('item-r2-1', 'twitter', 'R2 pricing page update is much clearer now. Finally pulled the trigger on migration.',       '@cloud_migrator', 'Pro',        '2025-05-06T01:00:00Z', 'positive',  0.70, 0.10),
  ('item-r2-2', 'forum',   'Moved 500GB to R2 after the pricing clarification. Zero egress fees is real.',               'storage_guru',    'Business',   '2025-05-05T19:00:00Z', 'positive',  0.80, 0.10),
  ('item-r2-3', 'discord', 'R2 docs now make sense. Wish all cloud pricing was this transparent.',                        '@devops_lead',    'Enterprise', '2025-05-05T16:00:00Z', 'positive',  0.90, 0.05),
  ('item-r2-4', 'github',  'Updated R2 example costs in our infra docs, pricing is much more competitive now',           'github.com/.../commit/abc123', 'Pro', '2025-05-05T13:00:00Z', 'positive', 0.60, 0.10),
  ('item-r2-5', 'twitter', 'R2 egress pricing finally makes sense after the doc update. Moved 2TB from S3 last week.',   '@startup_cfo',    'Pro',        '2025-05-05T11:00:00Z', 'positive',  0.70, 0.10),
  ('item-r2-6', 'forum',   'Still a bit confused on R2 vs S3 for large files but getting there',                         'storage_newbie',  'Free',       '2025-05-05T08:00:00Z', 'neutral',  -0.10, 0.15);

-- ── Signal ↔ Enrichment Junction ─────────────────────────────────────────────

INSERT OR IGNORE INTO signal_items (signal_id, item_id) VALUES
  ('signal-1', 'item-1'),  ('signal-1', 'item-2'),  ('signal-1', 'item-3'),
  ('signal-1', 'item-4'),  ('signal-1', 'item-5'),  ('signal-1', 'item-6'),
  ('signal-1', 'item-7'),  ('signal-1', 'item-8'),  ('signal-1', 'item-9'),
  ('signal-1', 'item-10'), ('signal-1', 'item-11'), ('signal-1', 'item-12'),
  ('signal-2', 'item-d1-1'), ('signal-2', 'item-d1-2'), ('signal-2', 'item-d1-3'),
  ('signal-2', 'item-d1-4'), ('signal-2', 'item-d1-5'), ('signal-2', 'item-d1-6'),
  ('signal-2', 'item-d1-7'), ('signal-2', 'item-d1-8'),
  ('signal-3', 'item-r2-1'), ('signal-3', 'item-r2-2'), ('signal-3', 'item-r2-3'),
  ('signal-3', 'item-r2-4'), ('signal-3', 'item-r2-5'), ('signal-3', 'item-r2-6');

-- ── Signal Edges (Vectorize KNN materialized relationships) ───────────────────

INSERT OR IGNORE INTO signal_edges (source_id, target_id, similarity_score) VALUES
  ('signal-1', 'signal-2', 0.61),  -- Workers AI ↔ D1 share DX theme overlap
  ('signal-2', 'signal-1', 0.61),
  ('signal-1', 'signal-3', 0.34),
  ('signal-3', 'signal-1', 0.34),
  ('signal-2', 'signal-3', 0.29),
  ('signal-3', 'signal-2', 0.29);

-- ── Brief ────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO briefs (id, headline, summary, generated_at, kv_key, policy_id)
VALUES (
  'brief-2025-05-06-01',
  'Workers AI rate-limit errors are spiking among enterprise customers.',
  'Three signals worth your attention this morning. Volume is up 34% week-over-week, and sentiment on Workers AI billing has slipped meaningfully since Friday''s pricing update. One emerging theme around D1 local-dev ergonomics is worth watching but not yet acting on.',
  '2025-05-06T07:02:00Z',
  'brief:latest',
  'policy-default'
);

INSERT OR IGNORE INTO brief_signals (brief_id, signal_id, rank) VALUES
  ('brief-2025-05-06-01', 'signal-1', 1),
  ('brief-2025-05-06-01', 'signal-2', 2),
  ('brief-2025-05-06-01', 'signal-3', 3);
