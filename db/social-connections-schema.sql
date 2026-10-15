-- First-party OAuth connections for BlueHaven AI World.
-- Additive only; does not modify existing tables.
CREATE TABLE IF NOT EXISTS social_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  pkce_verifier TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_oauth_states_expiry_idx ON social_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS social_provider_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT 'default',
  account_label TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  token_type TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','needs_reauthorization','error','disabled')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, account_id)
);
CREATE INDEX IF NOT EXISTS social_provider_tokens_status_idx ON social_provider_tokens(status, provider);
