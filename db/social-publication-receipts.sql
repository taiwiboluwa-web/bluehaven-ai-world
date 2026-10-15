-- Append-only receipts for first-party social publishing.
CREATE TABLE IF NOT EXISTS social_publication_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','published','failed')),
  remote_post_id TEXT,
  published_url TEXT,
  response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(provider, idempotency_key)
);
CREATE INDEX IF NOT EXISTS social_publication_receipts_provider_idx ON social_publication_receipts(provider, attempted_at DESC);
