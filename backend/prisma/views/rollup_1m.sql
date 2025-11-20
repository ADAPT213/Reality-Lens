-- Materialized View: 1-minute rollup of ergonomic metrics
-- Purpose: Pre-aggregate ergonomic data for fast dashboard queries
-- Refresh: Every 1-5 minutes via materialized-views.service.ts

CREATE MATERIALIZED VIEW IF NOT EXISTS rollup_1m AS
SELECT
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    DATE_TRUNC('minute', event_time) AS bucket_time,
    COUNT(*) AS snapshot_count,
    AVG(rula_score) AS avg_rula_score,
    MAX(rula_score) AS max_rula_score,
    AVG(reba_score) AS avg_reba_score,
    MAX(reba_score) AS max_reba_score,
    AVG(niosh_index) AS avg_niosh_index,
    MAX(niosh_index) AS max_niosh_index,
    AVG(composite_risk) AS avg_composite_risk,
    MAX(composite_risk) AS max_composite_risk,
    COUNT(*) FILTER (WHERE traffic_light = 'green') AS green_count,
    COUNT(*) FILTER (WHERE traffic_light = 'yellow') AS yellow_count,
    COUNT(*) FILTER (WHERE traffic_light = 'red') AS red_count,
    MODE() WITHIN GROUP (ORDER BY traffic_light) AS dominant_traffic_light,
    MIN(event_time) AS window_start,
    MAX(event_time) AS window_end
FROM ergonomic_snapshots
WHERE event_time >= NOW() - INTERVAL '7 days'
GROUP BY 
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    DATE_TRUNC('minute', event_time);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_rollup_1m_warehouse_time 
    ON rollup_1m (warehouse_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_1m_zone_time 
    ON rollup_1m (zone_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_1m_location_time 
    ON rollup_1m (pick_location_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_1m_bucket 
    ON rollup_1m (bucket_time DESC);

-- Add comments
COMMENT ON MATERIALIZED VIEW rollup_1m IS 'Pre-aggregated 1-minute ergonomic metrics for dashboard queries';
