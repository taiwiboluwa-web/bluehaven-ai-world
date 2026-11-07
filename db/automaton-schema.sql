-- BlueHaven Automaton foundation: additive, isolated ledger and run-control tables.
-- No private keys, seed phrases, API secrets, or real funds are stored here.
CREATE TABLE IF NOT EXISTS automaton_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE DEFAULT 'BlueHaven Automaton',
  status VARCHAR(24) NOT NULL DEFAULT 'paused'
    CHECK (status IN ('paused','ready','running','blocked','error')),
  execution_mode VARCHAR(24) NOT NULL DEFAULT 'simulation'
    CHECK (execution_mode IN ('simulation','sandbox')),
  max_run_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0.25 CHECK (max_run_cost_usd >= 0),
  daily_budget_usd NUMERIC(12,4) NOT NULL DEFAULT 2.00 CHECK (daily_budget_usd >= 0),
  require_cho_approval BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automaton_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_agent_id UUID REFERENCES automaton_agents(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'standby'
    CHECK (status IN ('standby','working','paused','retired','error')),
  created_by VARCHAR(24) NOT NULL DEFAULT 'cho'
    CHECK (created_by IN ('cho','automaton')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_agent_id, name)
);
CREATE TABLE IF NOT EXISTS automaton_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES automaton_agents(id) ON DELETE SET NULL,
  parent_run_id UUID REFERENCES automaton_runs(id) ON DELETE SET NULL,
  goal TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','planning','awaiting_approval','running','succeeded','failed','cancelled','blocked')),
  mode VARCHAR(24) NOT NULL DEFAULT 'simulation'
    CHECK (mode IN ('simulation','sandbox')),
  estimated_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  actual_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (actual_cost_usd >= 0),
  result JSONB,
  error TEXT,
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automaton_runs_created_idx ON automaton_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS automaton_runs_status_idx ON automaton_runs(status, created_at DESC);
CREATE TABLE IF NOT EXISTS automaton_wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  entry_type VARCHAR(24) NOT NULL
    CHECK (entry_type IN ('simulated_funding','simulated_revenue','expense','refund','adjustment')),
  amount_usd NUMERIC(12,4) NOT NULL CHECK (amount_usd <> 0),
  description TEXT NOT NULL,
  run_id UUID REFERENCES automaton_runs(id) ON DELETE SET NULL,
  external_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automaton_wallet_ledger_created_idx ON automaton_wallet_ledger(created_at DESC);
CREATE TABLE IF NOT EXISTS automaton_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES automaton_runs(id) ON DELETE CASCADE,
  action_type VARCHAR(80) NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by VARCHAR(100),
  decision_note TEXT
);
CREATE INDEX IF NOT EXISTS automaton_approvals_pending_idx ON automaton_approvals(status, requested_at DESC);
INSERT INTO automaton_instances (name, status, execution_mode, max_run_cost_usd, daily_budget_usd, require_cho_approval)
VALUES ('BlueHaven Automaton','paused','simulation',0.25,2.00,TRUE)
ON CONFLICT (name) DO NOTHING;
INSERT INTO automaton_agents (name, purpose, created_by)
VALUES ('Automaton Prime','Plans and coordinates approved autonomous work inside BlueHaven AI World.','cho')
ON CONFLICT (parent_agent_id, name) DO NOTHING;
