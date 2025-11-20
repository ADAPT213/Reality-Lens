-- Materialized View: 5-minute rollup of ergonomic metrics
-- Purpose: Pre-aggregate ergonomic data for trend analysis
-- Refresh: Every 5-10 minutes via materialized-views.service.ts

CREATE MATERIALIZED VIEW IF NOT EXISTS rollup_5m AS
SELECT
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    DATE_TRUNC('minute', event_time) - 
        ((EXTRACT(MINUTE FROM event_time)::INTEGER % 5) || ' minutes')::INTERVAL AS bucket_time,
    COUNT(*) AS snapshot_count,
    AVG(rula_score) AS avg_rula_score,
    MAX(rula_score) AS max_rula_score,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rula_score) AS p95_rula_score,
    AVG(reba_score) AS avg_reba_score,
    MAX(reba_score) AS max_reba_score,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY reba_score) AS p95_reba_score,
    AVG(niosh_index) AS avg_niosh_index,
    MAX(niosh_index) AS max_niosh_index,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY niosh_index) AS p95_niosh_index,
    AVG(composite_risk) AS avg_composite_risk,
    MAX(composite_risk) AS max_composite_risk,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY composite_risk) AS p95_composite_risk,
    COUNT(*) FILTER (WHERE traffic_light = 'green') AS green_count,
    COUNT(*) FILTER (WHERE traffic_light = 'yellow') AS yellow_count,
    COUNT(*) FILTER (WHERE traffic_light = 'red') AS red_count,
    (COUNT(*) FILTER (WHERE traffic_light = 'red')::FLOAT / NULLIF(COUNT(*), 0)) AS red_ratio,
    MODE() WITHIN GROUP (ORDER BY traffic_light) AS dominant_traffic_light,
    MIN(event_time) AS window_start,
    MAX(event_time) AS window_end
FROM ergonomic_snapshots
WHERE event_time >= NOW() - INTERVAL '30 days'
GROUP BY 
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    bucket_time;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_rollup_5m_warehouse_time 
    ON rollup_5m (warehouse_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_5m_zone_time 
    ON rollup_5m (zone_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_5m_location_time 
    ON rollup_5m (pick_location_id, bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_5m_bucket 
    ON rollup_5m (bucket_time DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_5m_red_ratio 
    ON rollup_5m (red_ratio DESC NULLS LAST);

COMMENT ON MATERIALIZED VIEW rollup_5m IS 'Pre-aggregated 5-minute ergonomic metrics with percentiles for trend analysis';
