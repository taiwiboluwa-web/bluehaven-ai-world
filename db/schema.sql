-- BlueHaven AI World initial schema and company operating system.
-- Additive and safe to re-run: all objects use IF NOT EXISTS.
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
  status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
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

-- Company hierarchy: human CHO, Chief of Staff Matthew, ten AI department heads, named workers.
CREATE TABLE IF NOT EXISTS company_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  authority_level VARCHAR(32) NOT NULL CHECK (authority_level IN ('cho','chief_of_staff')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(6) NOT NULL UNIQUE,
  department VARCHAR(80) NOT NULL,
  role_description TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','working','waiting','paused','error')),
  model_id VARCHAR(200),
  connector_id VARCHAR(80) NOT NULL DEFAULT 'universal',
  system_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  department_agent_id UUID NOT NULL REFERENCES company_agents(id) ON DELETE RESTRICT,
  role_title VARCHAR(120) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','active','paused','retired')),
  hired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, department_agent_id)
);
CREATE TABLE IF NOT EXISTS company_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  department_agent_id UUID REFERENCES company_agents(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES company_workers(id) ON DELETE SET NULL,
  created_by VARCHAR(80) NOT NULL DEFAULT 'CHO',
  status VARCHAR(24) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','blocked','completed','failed','cancelled')),
  priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  result_summary TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_tasks_created_idx ON company_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS company_tasks_status_idx ON company_tasks(status);
CREATE TABLE IF NOT EXISTS hiring_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_agent_id UUID REFERENCES company_agents(id) ON DELETE SET NULL,
  department_agent_id UUID NOT NULL REFERENCES company_agents(id) ON DELETE RESTRICT,
  proposed_name VARCHAR(80) NOT NULL,
  role_title VARCHAR(120) NOT NULL,
  business_case TEXT NOT NULL,
  estimated_monthly_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_monthly_cost >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'pending_matthew' CHECK (status IN ('pending_matthew','pending_cho','rejected_by_matthew','approved','rejected_by_cho','hired')),
  matthew_decision_note TEXT,
  cho_decision_note TEXT,
  reviewed_by_matthew_at TIMESTAMPTZ,
  decided_by_cho_at TIMESTAMPTZ,
  created_worker_id UUID REFERENCES company_workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hiring_requests_status_idx ON hiring_requests(status, created_at DESC);
CREATE TABLE IF NOT EXISTS company_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role VARCHAR(24) NOT NULL DEFAULT 'cho',
  notification_type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  related_task_id UUID REFERENCES company_tasks(id) ON DELETE SET NULL,
  related_hiring_request_id UUID REFERENCES hiring_requests(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_notifications_inbox_idx ON company_notifications(recipient_role, read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT NOT NULL DEFAULT '',
  tasks_total INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  tasks_blocked INTEGER NOT NULL DEFAULT 0,
  hiring_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  notable_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(24) NOT NULL CHECK (actor_type IN ('cho','chief_of_staff','agent','worker','system')),
  actor_name VARCHAR(80) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(60),
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO company_people (full_name, title, authority_level)
VALUES ('CHO', 'Chief Human Officer', 'cho'), ('Matthew', 'Chief of Staff', 'chief_of_staff')
ON CONFLICT (full_name) DO UPDATE SET title = EXCLUDED.title, authority_level = EXCLUDED.authority_level;

INSERT INTO company_agents (name, department, role_description, system_prompt) VALUES
 ('Nova','Research','Finds and synthesizes information with source notes.','You are Nova, BlueHaven research lead. Cite sources and flag uncertainty.'),
 ('Sage','Knowledge & RAG','Organizes documents, knowledge retrieval and source-grounded answers.','You are Sage, BlueHaven knowledge lead. Ground answers in available documents.'),
 ('Echo','Communications','Drafts communications, messages, briefs and customer responses.','You are Echo, BlueHaven communications lead. Keep tone clear and appropriate.'),
 ('Pixel','Design & Media','Supports visual concepts, content planning and media production.','You are Pixel, BlueHaven design and media lead. Follow brand and asset requirements.'),
 ('Forge','Software Engineering','Plans and implements code changes with tests and review.','You are Forge, BlueHaven engineering lead. Prefer small tested changes and preserve existing systems.'),
 ('Scout','Web Research','Researches websites, public sources and competitor information.','You are Scout, BlueHaven web research lead. Distinguish evidence from assumptions.'),
 ('Atlas','Planning & Strategy','Breaks goals into plans, milestones, dependencies and priorities.','You are Atlas, BlueHaven planning lead. Produce actionable plans with owners and risks.'),
 ('Piper','Automation','Designs repeatable workflows and integrations.','You are Piper, BlueHaven automation lead. Require approval for consequential actions.'),
 ('Quinn','Quality & Security','Reviews outputs, tests, access controls and risk.','You are Quinn, BlueHaven quality and security lead. Surface risks and test failure paths.'),
 ('Orbit','Operations & Analytics','Tracks operations, performance, usage and reporting.','You are Orbit, BlueHaven operations lead. Report measurable status and blockers.')
ON CONFLICT (name) DO UPDATE SET department = EXCLUDED.department, role_description = EXCLUDED.role_description, system_prompt = EXCLUDED.system_prompt, connector_id = 'universal';
