-- Materialized View: Worker exposure minutes by risk level
-- Purpose: Track cumulative worker exposure to different risk levels
-- Refresh: Every 10-15 minutes via materialized-views.service.ts

CREATE MATERIALIZED VIEW IF NOT EXISTS worker_exposure_minutes AS
SELECT
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    DATE_TRUNC('hour', event_time) AS hour_bucket,
    -- Exposure time estimates (assuming 1 snapshot per minute)
    COUNT(*) FILTER (WHERE traffic_light = 'green') AS green_minutes,
    COUNT(*) FILTER (WHERE traffic_light = 'yellow') AS yellow_minutes,
    COUNT(*) FILTER (WHERE traffic_light = 'red') AS red_minutes,
    COUNT(*) AS total_minutes,
    -- Risk-weighted exposure score
    (
        COUNT(*) FILTER (WHERE traffic_light = 'green') * 1.0 +
        COUNT(*) FILTER (WHERE traffic_light = 'yellow') * 2.0 +
        COUNT(*) FILTER (WHERE traffic_light = 'red') * 5.0
    ) AS weighted_exposure_score,
    -- Percentages
    (COUNT(*) FILTER (WHERE traffic_light = 'red')::FLOAT / 
        NULLIF(COUNT(*), 0) * 100) AS red_percentage,
    (COUNT(*) FILTER (WHERE traffic_light = 'yellow')::FLOAT / 
        NULLIF(COUNT(*), 0) * 100) AS yellow_percentage,
    (COUNT(*) FILTER (WHERE traffic_light = 'green')::FLOAT / 
        NULLIF(COUNT(*), 0) * 100) AS green_percentage,
    -- Average scores during exposure
    AVG(composite_risk) FILTER (WHERE traffic_light = 'red') AS avg_red_risk,
    AVG(composite_risk) FILTER (WHERE traffic_light = 'yellow') AS avg_yellow_risk,
    MAX(composite_risk) AS max_risk_in_hour,
    -- Time range
    MIN(event_time) AS period_start,
    MAX(event_time) AS period_end
FROM ergonomic_snapshots
WHERE event_time >= NOW() - INTERVAL '30 days'
GROUP BY 
    warehouse_id,
    zone_id,
    pick_location_id,
    shift_code,
    DATE_TRUNC('hour', event_time);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worker_exposure_warehouse_time 
    ON worker_exposure_minutes (warehouse_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_worker_exposure_zone_time 
    ON worker_exposure_minutes (zone_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_worker_exposure_location_time 
    ON worker_exposure_minutes (pick_location_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_worker_exposure_red_pct 
    ON worker_exposure_minutes (red_percentage DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_worker_exposure_score 
    ON worker_exposure_minutes (weighted_exposure_score DESC);

COMMENT ON MATERIALIZED VIEW worker_exposure_minutes IS 'Hourly worker exposure tracking by risk level with weighted scoring';
