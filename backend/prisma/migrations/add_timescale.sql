-- Migration: Add TimescaleDB hypertables or Postgres partitioning for time-series data
-- Created: 2025-11-17
-- Description: Converts ergonomic_snapshots and shift_snapshots to hypertables (TimescaleDB)
--              or native partitioned tables (PostgreSQL fallback)

-- =============================================================================
-- 1. Add new fields for time-series optimization
-- =============================================================================

-- Add retention_days to warehouses if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'retention_days'
    ) THEN
        ALTER TABLE warehouses ADD COLUMN retention_days INTEGER DEFAULT 90 NOT NULL;
    END IF;
END $$;

-- Add event_time and ingest_time to ergonomic_snapshots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ergonomic_snapshots' AND column_name = 'event_time'
    ) THEN
        -- Set event_time to timestamp if it doesn't exist
        ALTER TABLE ergonomic_snapshots ADD COLUMN event_time TIMESTAMP NOT NULL DEFAULT NOW();
        UPDATE ergonomic_snapshots SET event_time = timestamp WHERE event_time = NOW();
        ALTER TABLE ergonomic_snapshots ALTER COLUMN event_time DROP DEFAULT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ergonomic_snapshots' AND column_name = 'ingest_time'
    ) THEN
        ALTER TABLE ergonomic_snapshots ADD COLUMN ingest_time TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
END $$;

-- Add event_time and ingest_time to shift_snapshots
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_snapshots' AND column_name = 'event_time'
    ) THEN
        -- Set event_time to bucket_start if it doesn't exist
        ALTER TABLE shift_snapshots ADD COLUMN event_time TIMESTAMP NOT NULL DEFAULT NOW();
        UPDATE shift_snapshots SET event_time = bucket_start WHERE event_time = NOW();
        ALTER TABLE shift_snapshots ALTER COLUMN event_time DROP DEFAULT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shift_snapshots' AND column_name = 'ingest_time'
    ) THEN
        ALTER TABLE shift_snapshots ADD COLUMN ingest_time TIMESTAMP DEFAULT NOW() NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- 2. Create indexes for time-series queries
-- =============================================================================

-- Indexes for ergonomic_snapshots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ergonomic_warehouse_time 
    ON ergonomic_snapshots (warehouse_id, event_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ergonomic_zone_time 
    ON ergonomic_snapshots (zone_id, event_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ergonomic_traffic_time 
    ON ergonomic_snapshots (traffic_light, event_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ergonomic_event_time 
    ON ergonomic_snapshots (event_time DESC);

-- Indexes for shift_snapshots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_warehouse_time 
    ON shift_snapshots (warehouse_id, event_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_code_time 
    ON shift_snapshots (shift_code, event_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_event_time 
    ON shift_snapshots (event_time DESC);

-- =============================================================================
-- 3. TimescaleDB Hypertables (if TimescaleDB extension is available)
-- =============================================================================

DO $$
DECLARE
    timescale_installed BOOLEAN;
BEGIN
    -- Check if TimescaleDB is installed
    SELECT COUNT(*) > 0 INTO timescale_installed
    FROM pg_extension WHERE extname = 'timescaledb';

    IF timescale_installed THEN
        RAISE NOTICE 'TimescaleDB detected - creating hypertables';

        -- Convert ergonomic_snapshots to hypertable
        -- Only convert if not already a hypertable
        IF NOT EXISTS (
            SELECT 1 FROM timescaledb_information.hypertables 
            WHERE hypertable_name = 'ergonomic_snapshots'
        ) THEN
            PERFORM create_hypertable(
                'ergonomic_snapshots',
                'event_time',
                chunk_time_interval => INTERVAL '1 day',
                migrate_data => TRUE,
                if_not_exists => TRUE
            );
            RAISE NOTICE 'Converted ergonomic_snapshots to hypertable';
        END IF;

        -- Convert shift_snapshots to hypertable
        IF NOT EXISTS (
            SELECT 1 FROM timescaledb_information.hypertables 
            WHERE hypertable_name = 'shift_snapshots'
        ) THEN
            PERFORM create_hypertable(
                'shift_snapshots',
                'event_time',
                chunk_time_interval => INTERVAL '1 day',
                migrate_data => TRUE,
                if_not_exists => TRUE
            );
            RAISE NOTICE 'Converted shift_snapshots to hypertable';
        END IF;

        -- Add compression policies (optional, improves storage)
        PERFORM add_compression_policy('ergonomic_snapshots', INTERVAL '7 days');
        PERFORM add_compression_policy('shift_snapshots', INTERVAL '7 days');

        -- Add retention policies will be managed by our custom job based on warehouse.retention_days
        
    ELSE
        RAISE NOTICE 'TimescaleDB not found - using native PostgreSQL partitioning';
    END IF;
END $$;

-- =============================================================================
-- 4. PostgreSQL Native Partitioning (fallback if TimescaleDB not available)
-- =============================================================================

-- Note: Native partitioning requires recreating tables, so we create functions
-- that can be called manually if needed. The app will handle partitions dynamically.

-- Function to create partitions for ergonomic_snapshots
CREATE OR REPLACE FUNCTION create_ergonomic_snapshot_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'ergonomic_snapshots_' || TO_CHAR(partition_date, 'YYYY_MM_DD');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 day';

    -- Check if partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF ergonomic_snapshots 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create partitions for shift_snapshots
CREATE OR REPLACE FUNCTION create_shift_snapshot_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'shift_snapshots_' || TO_CHAR(partition_date, 'YYYY_MM_DD');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 day';

    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF shift_snapshots 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. Helper functions for data management
-- =============================================================================

-- Function to get retention date for a warehouse
CREATE OR REPLACE FUNCTION get_retention_cutoff_date(p_warehouse_id VARCHAR)
RETURNS TIMESTAMP AS $$
DECLARE
    retention_days INTEGER;
BEGIN
    SELECT w.retention_days INTO retention_days
    FROM warehouses w
    WHERE w.id = p_warehouse_id;
    
    RETURN NOW() - (COALESCE(retention_days, 90) || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to purge old ergonomic snapshots
CREATE OR REPLACE FUNCTION purge_old_ergonomic_snapshots(p_warehouse_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := get_retention_cutoff_date(p_warehouse_id);
    
    DELETE FROM ergonomic_snapshots
    WHERE warehouse_id = p_warehouse_id 
      AND event_time < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to purge old shift snapshots
CREATE OR REPLACE FUNCTION purge_old_shift_snapshots(p_warehouse_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := get_retention_cutoff_date(p_warehouse_id);
    
    DELETE FROM shift_snapshots
    WHERE warehouse_id = p_warehouse_id 
      AND event_time < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. Statistics and analysis helpers
-- =============================================================================

-- Analyze tables for query optimization
ANALYZE ergonomic_snapshots;
ANALYZE shift_snapshots;
ANALYZE warehouses;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'Migration completed successfully';
    RAISE NOTICE '=============================================================';
END $$;
