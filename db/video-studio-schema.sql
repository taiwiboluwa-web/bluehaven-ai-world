-- BlueHaven AI Video Studio: additive foundation.
-- Apply to the isolated Neon video-studio-dev branch first.
-- Does not alter or drop existing AI World tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS video_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO video_workspaces (slug, name)
VALUES ('bluehaven-studios', 'BlueHaven Studios')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  default_aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (default_aspect_ratio IN ('9:16','16:9','1:1')),
  brand_kit_id UUID,
  created_by TEXT NOT NULL DEFAULT 'CHO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_projects_workspace_created_idx
  ON video_projects(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS video_brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  logo_asset_id UUID,
  primary_color TEXT NOT NULL DEFAULT '#FFDE59',
  secondary_color TEXT NOT NULL DEFAULT '#7F56D6',
  font_family TEXT,
  voice_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  subtitle_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  music_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

-- Brand-kit association is resolved by workspace/project metadata; no cyclic FK is required.



CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  engine TEXT NOT NULL DEFAULT 'moneyprinterturbo',
  engine_task_id TEXT,
  job_type TEXT NOT NULL DEFAULT 'script_to_video' CHECK (job_type IN ('script_to_video','render','voiceover','subtitles','thumbnail','variant')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('draft','awaiting_approval','queued','submitted','processing','rendering','uploading','completed','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  idempotency_key TEXT,
  estimated_cost_usd NUMERIC(12,4),
  actual_cost_usd NUMERIC(12,4),
  created_by TEXT NOT NULL DEFAULT 'CHO',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS video_jobs_workspace_created_idx
  ON video_jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_jobs_status_created_idx
  ON video_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS video_jobs_engine_task_idx
  ON video_jobs(engine, engine_task_id);

CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES video_jobs(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('video','thumbnail','image','audio','subtitle','source','other')),
  storage_provider TEXT NOT NULL DEFAULT 'pending',
  storage_bucket TEXT,
  object_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  duration_seconds NUMERIC(10,3),
  width INTEGER,
  height INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_assets_project_created_idx
  ON video_assets(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_assets_job_idx
  ON video_assets(job_id);

CREATE TABLE IF NOT EXISTS video_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','changes_requested')),
  requested_by TEXT NOT NULL DEFAULT 'CHO',
  reviewed_by TEXT,
  review_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_approvals_workspace_status_idx
  ON video_approvals(workspace_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS video_job_events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_job_events_job_created_idx
  ON video_job_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS video_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  job_id UUID REFERENCES video_jobs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  quantity NUMERIC(16,6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  estimated_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(12,4),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','settled','released','refunded')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS video_usage_workspace_created_idx
  ON video_usage_ledger(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS video_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  connection_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','connected','error','disabled')),
  secret_ref TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider, connection_label)
);

CREATE TABLE IF NOT EXISTS video_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES video_workspaces(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES video_jobs(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_approval','completed','failed','cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS video_agent_runs_job_created_idx
  ON video_agent_runs(job_id, created_at DESC);

-- Seed a first project and a BlueHaven default brand kit without touching existing AI World data.
INSERT INTO video_brand_kits (workspace_id, name, is_default, primary_color, secondary_color, rules)
SELECT id, 'BlueHaven Studios', true, '#FFDE59', '#7F56D6',
       '{"brand":"BlueHaven Studios","tagline":"Creativity Beyond Limits","approval_required_before_publish":true}'::jsonb
FROM video_workspaces
WHERE slug = 'bluehaven-studios'
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO video_projects (workspace_id, name, description, default_aspect_ratio, created_by)
SELECT w.id, 'BlueHaven Video Studio', 'Central workspace for AI-assisted video production.', '9:16', 'CHO'
FROM video_workspaces w
WHERE w.slug = 'bluehaven-studios'
  AND NOT EXISTS (
    SELECT 1 FROM video_projects p
    WHERE p.workspace_id = w.id AND p.name = 'BlueHaven Video Studio'
  );
