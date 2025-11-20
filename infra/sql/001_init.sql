-- warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zones
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pick locations
CREATE TABLE IF NOT EXISTS pick_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES zones(id),
  label TEXT NOT NULL,
  x_coord NUMERIC,
  y_coord NUMERIC,
  z_height_cm NUMERIC,
  reach_band TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- users (minimal for FK)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- skus
CREATE TABLE IF NOT EXISTS skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  sku_code TEXT NOT NULL,
  description TEXT,
  weight_kg NUMERIC,
  volume_cm3 NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_location_id UUID NOT NULL REFERENCES pick_locations(id),
  sku_id UUID NOT NULL REFERENCES skus(id),
  from_ts TIMESTAMPTZ NOT NULL,
  to_ts TIMESTAMPTZ,
  avg_picks_per_hour NUMERIC
);

-- uploads
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id),
  zone_id UUID REFERENCES zones(id),
  uploaded_by UUID REFERENCES users(id),
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
