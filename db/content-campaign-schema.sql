-- BlueHaven Content Command: additive campaign persistence.
-- Run against the existing BlueHaven AI World Neon database.
-- This migration does not alter existing tables.
CREATE TABLE IF NOT EXISTS content_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  start_date DATE NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 40 CHECK (duration_days BETWEEN 1 AND 366),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','failed')),
  publish_mode TEXT NOT NULL DEFAULT 'draft_only' CHECK (publish_mode IN ('draft_only','review_then_publish','auto_publish')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_campaign_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 366),
  campaign_date DATE NOT NULL,
  theme TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','generating','drafted','scheduled','published','partial','failed','skipped')),
  run_started_at TIMESTAMPTZ,
  run_finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, day_number),
  UNIQUE(campaign_id, campaign_date)
);
CREATE TABLE IF NOT EXISTS content_campaign_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
  campaign_day_id UUID NOT NULL REFERENCES content_campaign_days(id) ON DELETE CASCADE,
  post_number INTEGER NOT NULL CHECK (post_number BETWEEN 1 AND 5),
  topic TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','instagram','tiktok','pinterest','website','medium','blogger')),
  x_copy TEXT,
  caption TEXT,
  seo_snippet TEXT,
  visual_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_handles JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_review','approved','queued','scheduled','publishing','published','failed','cancelled')),
  provider TEXT,
  provider_post_id TEXT,
  published_url TEXT,
  provider_response JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_day_id, post_number, platform)
);
CREATE INDEX IF NOT EXISTS content_campaign_days_status_idx ON content_campaign_days(status, campaign_date);
CREATE INDEX IF NOT EXISTS content_campaign_posts_schedule_idx ON content_campaign_posts(status, scheduled_for);
CREATE INDEX IF NOT EXISTS content_campaign_posts_day_idx ON content_campaign_posts(campaign_day_id, post_number);
CREATE TABLE IF NOT EXISTS content_campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
  campaign_day_id UUID REFERENCES content_campaign_days(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('prepare','publish','analytics','manual')),
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','partial','failed','skipped')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS content_campaign_runs_created_idx ON content_campaign_runs(campaign_id, started_at DESC);
CREATE TABLE IF NOT EXISTS content_channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  account_label TEXT,
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','pending_authorization','connected','error','disabled')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_secret_ref TEXT,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, channel)
);
