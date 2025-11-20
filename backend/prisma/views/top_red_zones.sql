-- Materialized View: Top red zones ranked by risk exposure
-- Purpose: Identify highest-risk zones for immediate attention
-- Refresh: Every 5-10 minutes via materialized-views.service.ts

CREATE MATERIALIZED VIEW IF NOT EXISTS top_red_zones AS
SELECT
    z.id AS zone_id,
    z.warehouse_id,
    z.name AS zone_name,
    z.code AS zone_code,
    w.name AS warehouse_name,
    COUNT(*) AS total_red_snapshots,
    COUNT(DISTINCT es.pick_location_id) AS affected_locations,
    AVG(es.composite_risk) AS avg_composite_risk,
    MAX(es.composite_risk) AS max_composite_risk,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY es.composite_risk) AS p95_composite_risk,
    AVG(es.rula_score) AS avg_rula_score,
    MAX(es.rula_score) AS max_rula_score,
    AVG(es.reba_score) AS avg_reba_score,
    MAX(es.reba_score) AS max_reba_score,
    AVG(es.niosh_index) AS avg_niosh_index,
    MAX(es.niosh_index) AS max_niosh_index,
    MIN(es.event_time) AS first_red_at,
    MAX(es.event_time) AS last_red_at,
    MAX(es.event_time) - MIN(es.event_time) AS exposure_duration,
    COUNT(DISTINCT es.shift_code) AS shifts_affected,
    -- Risk score: combine frequency, severity, and recency
    (
        (COUNT(*)::FLOAT / 100.0) * 0.3 +  -- Frequency weight
        AVG(es.composite_risk)::FLOAT * 0.4 +  -- Severity weight
        (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - MAX(es.event_time))) / 3600.0)) * 0.3  -- Recency weight
    ) AS priority_score
FROM ergonomic_snapshots es
JOIN zones z ON es.zone_id = z.id
JOIN warehouses w ON z.warehouse_id = w.id
WHERE es.traffic_light = 'red'
  AND es.event_time >= NOW() - INTERVAL '7 days'
GROUP BY 
    z.id,
    z.warehouse_id,
    z.name,
    z.code,
    w.name
HAVING COUNT(*) >= 3  -- At least 3 red flags
ORDER BY priority_score DESC
LIMIT 100;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_top_red_zones_warehouse 
    ON top_red_zones (warehouse_id, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_top_red_zones_score 
    ON top_red_zones (priority_score DESC);

COMMENT ON MATERIALIZED VIEW top_red_zones IS 'Top 100 zones by red-flag exposure with priority scoring';
