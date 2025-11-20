-- Materialized View: Posture type distribution and trends
-- Purpose: Track distribution of posture types and risk patterns over time
-- Refresh: Every 15 minutes via materialized-views.service.ts

CREATE MATERIALIZED VIEW IF NOT EXISTS posture_type_counts AS
SELECT
    warehouse_id,
    zone_id,
    DATE_TRUNC('hour', event_time) AS hour_bucket,
    traffic_light,
    -- Risk band categorization
    CASE
        WHEN rula_score IS NULL THEN 'unknown'
        WHEN rula_score <= 2 THEN 'low'
        WHEN rula_score <= 4 THEN 'medium'
        WHEN rula_score <= 6 THEN 'high'
        ELSE 'very_high'
    END AS rula_band,
    CASE
        WHEN reba_score IS NULL THEN 'unknown'
        WHEN reba_score <= 3 THEN 'low'
        WHEN reba_score <= 7 THEN 'medium'
        WHEN reba_score <= 10 THEN 'high'
        ELSE 'very_high'
    END AS reba_band,
    CASE
        WHEN niosh_index IS NULL THEN 'unknown'
        WHEN niosh_index <= 1.0 THEN 'acceptable'
        WHEN niosh_index <= 2.0 THEN 'moderate'
        ELSE 'high'
    END AS niosh_band,
    -- Counts and statistics
    COUNT(*) AS snapshot_count,
    COUNT(DISTINCT pick_location_id) AS unique_locations,
    COUNT(DISTINCT shift_code) AS unique_shifts,
    AVG(rula_score) AS avg_rula,
    AVG(reba_score) AS avg_reba,
    AVG(niosh_index) AS avg_niosh,
    AVG(composite_risk) AS avg_composite_risk,
    STDDEV(composite_risk) AS stddev_composite_risk,
    MIN(event_time) AS period_start,
    MAX(event_time) AS period_end,
    -- Trending indicators
    CASE
        WHEN COUNT(*) > LAG(COUNT(*)) OVER (
            PARTITION BY warehouse_id, zone_id, traffic_light 
            ORDER BY DATE_TRUNC('hour', event_time)
        ) THEN 'increasing'
        WHEN COUNT(*) < LAG(COUNT(*)) OVER (
            PARTITION BY warehouse_id, zone_id, traffic_light 
            ORDER BY DATE_TRUNC('hour', event_time)
        ) THEN 'decreasing'
        ELSE 'stable'
    END AS trend_direction
FROM ergonomic_snapshots
WHERE event_time >= NOW() - INTERVAL '14 days'
GROUP BY 
    warehouse_id,
    zone_id,
    DATE_TRUNC('hour', event_time),
    traffic_light,
    rula_band,
    reba_band,
    niosh_band;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posture_counts_warehouse_time 
    ON posture_type_counts (warehouse_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_posture_counts_zone_time 
    ON posture_type_counts (zone_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_posture_counts_traffic 
    ON posture_type_counts (traffic_light, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_posture_counts_rula_band 
    ON posture_type_counts (rula_band, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_posture_counts_snapshot_count 
    ON posture_type_counts (snapshot_count DESC);

COMMENT ON MATERIALIZED VIEW posture_type_counts IS 'Hourly distribution of posture types with risk band categorization and trend analysis';
