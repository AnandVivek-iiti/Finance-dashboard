-- Finance dashboard schema (Postgres / Neon)
-- Run via `npm run migrate` (backend/db/migrate.js). Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,
  bank_profile TEXT NOT NULL DEFAULT 'unknown',
  account_number TEXT NOT NULL DEFAULT '',
  account_holder_name TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  ifsc_code TEXT NOT NULL DEFAULT '',

  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Integer paise, never floats (see utils/money.js) — matches original Mongo schema.
  opening_balance_paise INTEGER,
  closing_balance_paise INTEGER,

  transaction_count INTEGER NOT NULL DEFAULT 0,
  parse_error_count INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'processing',
  failure_reason TEXT NOT NULL DEFAULT '',

  continuity_warning JSONB,

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id);
CREATE INDEX IF NOT EXISTS idx_statements_user_account_period ON statements(user_id, account_number, period_end);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Duplicated from statements on purpose (defense-in-depth): every query
  -- filters on user_id directly instead of only trusting statement_id
  -- ownership, so a bug in a join can't leak another user's rows.
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,

  date TIMESTAMPTZ NOT NULL,
  transaction_id TEXT NOT NULL DEFAULT '',

  -- Exactly one of these two is non-null per row.
  withdrawal_paise INTEGER,
  deposit_paise INTEGER,
  balance_paise INTEGER NOT NULL,

  remarks TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),

  category TEXT NOT NULL DEFAULT 'Uncategorized',
  merchant_or_source TEXT NOT NULL DEFAULT '',

  category_manually_set BOOLEAN NOT NULL DEFAULT false,
  reconciled BOOLEAN NOT NULL DEFAULT true,

  raw_row_index INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_user_statement_date ON transactions(user_id, statement_id, date);
CREATE INDEX IF NOT EXISTS idx_txn_user_statement_category ON transactions(user_id, statement_id, category);
CREATE INDEX IF NOT EXISTS idx_txn_user_statement_type ON transactions(user_id, statement_id, type);

CREATE TABLE IF NOT EXISTS parse_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,

  row_index INTEGER,
  raw_row JSONB,
  reason TEXT NOT NULL,
  error_type TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_errors_statement ON parse_errors(statement_id);
CREATE INDEX IF NOT EXISTS idx_parse_errors_user ON parse_errors(user_id);

CREATE TABLE IF NOT EXISTS category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  normalized_remarks TEXT NOT NULL,
  category TEXT NOT NULL,
  merchant_or_source TEXT NOT NULL DEFAULT '',
  example_remarks TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Category corrections are scoped per user - a merchant/remark pattern
  -- learned from one person's account must never apply to another user's.
  UNIQUE (user_id, normalized_remarks)
);
