-- PostgreSQL & SQLite compatible schema for Prepaid LLM Proxy & Playground Platform
-- Precision: NUMERIC(18, 6) for sub-cent token billing (or integer micro-cents: 1 USD = 100,000,000 micro-cents)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  balance_usd NUMERIC(18, 6) NOT NULL DEFAULT 0.000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_pricing (
  model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  upstream_model_name TEXT NOT NULL,
  input_per_million NUMERIC(10, 4) NOT NULL,
  output_per_million NUMERIC(10, 4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(18, 6) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('playground', 'api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposit_ledger (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE NOT NULL,
  net_deposited_usd NUMERIC(10, 2) NOT NULL,
  gross_charged_usd NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  monthly_price_usd NUMERIC(10, 2) NOT NULL,
  dubbing_mins_allocated INTEGER NOT NULL DEFAULT 0,
  dubbing_mins_used INTEGER NOT NULL DEFAULT 0,
  voice_credits_allocated INTEGER NOT NULL DEFAULT 0,
  voice_credits_used INTEGER NOT NULL DEFAULT 0,
  text_chars_allocated INTEGER NOT NULL DEFAULT 0,
  text_chars_used INTEGER NOT NULL DEFAULT 0,
  transcribe_mins_allocated INTEGER NOT NULL DEFAULT 0,
  transcribe_mins_used INTEGER NOT NULL DEFAULT 0,
  images_allocated INTEGER NOT NULL DEFAULT 0,
  images_used INTEGER NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
