-- Add new columns to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'created';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alerts_state_priority ON alerts(state, priority);
CREATE INDEX IF NOT EXISTS idx_alerts_warehouse_triggered ON alerts(warehouse_id, triggered_at);

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  priority TEXT NOT NULL,
  conditions JSONB NOT NULL,
  hysteresis JSONB,
  cooldown_minutes INTEGER,
  rate_limit JSONB,
  channels JSONB NOT NULL,
  scope JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
