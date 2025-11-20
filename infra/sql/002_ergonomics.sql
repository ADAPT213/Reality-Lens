-- ergonomic snapshots
CREATE TABLE IF NOT EXISTS ergonomic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  zone_id UUID REFERENCES zones(id),
  pick_location_id UUID REFERENCES pick_locations(id),
  shift_code TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  rula_score INT,
  reba_score INT,
  niosh_index NUMERIC,
  composite_risk NUMERIC,
  traffic_light TEXT NOT NULL,
  reason TEXT,
  source_upload_id UUID REFERENCES uploads(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  shift_code TEXT,
  zone_id UUID REFERENCES zones(id),
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_by_rule TEXT NOT NULL,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
