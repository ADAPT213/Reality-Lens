-- shift snapshots
CREATE TABLE IF NOT EXISTS shift_snapshots (
  id BIGSERIAL PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  shift_code TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  avg_picks_per_hour NUMERIC,
  total_picks INT,
  green_locations INT,
  yellow_locations INT,
  red_locations INT,
  avg_composite_risk NUMERIC,
  anomaly_score NUMERIC,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
