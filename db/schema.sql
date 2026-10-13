-- BlueHaven AI World initial schema.
-- Safe to re-run: all objects use IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  purpose TEXT NOT NULL,
  template VARCHAR(100) NOT NULL,
  agent_type VARCHAR(60) NOT NULL DEFAULT 'document_qa',
  status VARCHAR(32) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','awaiting_construction','under_construction','initializing','active','processing','paused','updating','failed','offline')),
  grid_x INTEGER NOT NULL DEFAULT 0,
  grid_z INTEGER NOT NULL DEFAULT 0,
  footprint_width INTEGER NOT NULL DEFAULT 2,
  footprint_depth INTEGER NOT NULL DEFAULT 2,
  model_id VARCHAR(200),
  provider VARCHAR(80),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_projects_status_idx ON ai_projects(status);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  job_type VARCHAR(60) NOT NULL DEFAULT 'provision',
  status VARCHAR(32) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_jobs_project_created_idx ON agent_jobs(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_events (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES ai_projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES agent_jobs(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_events_project_created_idx ON agent_events(project_id, created_at DESC);
