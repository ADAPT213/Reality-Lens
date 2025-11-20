# Materialized Views

This directory contains SQL definitions for materialized views used to optimize time-series queries.

## Views

### rollup_1m.sql

**Purpose**: 1-minute aggregated ergonomic metrics  
**Refresh**: Every 1 minute  
**Retention**: 7 days  
**Use Cases**: Real-time dashboards, live monitoring

### rollup_5m.sql

**Purpose**: 5-minute aggregated ergonomic metrics with percentiles  
**Refresh**: Every 5 minutes  
**Retention**: 30 days  
**Use Cases**: Trend analysis, historical comparisons

### top_red_zones.sql

**Purpose**: Top 100 zones by red-flag exposure with priority scoring  
**Refresh**: Every 5 minutes  
**Retention**: 7 days  
**Use Cases**: Alert prioritization, risk hotspot identification

### worker_exposure_minutes.sql

**Purpose**: Hourly worker exposure tracking by risk level  
**Refresh**: Every 10 minutes  
**Retention**: 30 days  
**Use Cases**: Compliance reporting, exposure tracking

### posture_type_counts.sql

**Purpose**: Hourly distribution of posture types with trend analysis  
**Refresh**: Every 15 minutes  
**Retention**: 14 days  
**Use Cases**: Pattern analysis, ergonomic program effectiveness

## Creating Views

To create all materialized views in your database:

```bash
# Run each SQL file
psql $DATABASE_URL -f rollup_1m.sql
psql $DATABASE_URL -f rollup_5m.sql
psql $DATABASE_URL -f top_red_zones.sql
psql $DATABASE_URL -f worker_exposure_minutes.sql
psql $DATABASE_URL -f posture_type_counts.sql
```

Or use the helper script:

```bash
for view in *.sql; do
  echo "Creating view from $view"
  psql $DATABASE_URL -f "$view"
done
```

## Refresh Strategy

Views are automatically refreshed by the `MaterializedViewsService`:

- **Priority 1** (rollup_1m): Every minute
- **Priority 2** (rollup_5m, top_red_zones): Every 5 minutes
- **Priority 3** (worker_exposure_minutes, posture_type_counts): Every 10-15 minutes

Refresh operations use `REFRESH MATERIALIZED VIEW CONCURRENTLY` to avoid blocking reads.

## Query Patterns

### Example: Get recent 1-minute rollup

```typescript
const data = await materializedViewsService.getRollup1m(
  warehouseId,
  new Date(Date.now() - 3600000), // Last hour
  new Date(),
);
```

### Example: Get top red zones

```typescript
const redZones = await materializedViewsService.getTopRedZones(warehouseId, 10);
```

### Example: Get worker exposure

```typescript
const exposure = await materializedViewsService.getWorkerExposure(
  warehouseId,
  new Date(Date.now() - 86400000), // Last 24 hours
  new Date(),
);
```

## Performance Considerations

1. **Indexes**: All views have optimized indexes for common query patterns
2. **Concurrent Refresh**: Non-blocking refreshes allow queries during updates
3. **Retention**: Each view has appropriate data retention to balance performance and storage
4. **Partitioning**: Views work with both TimescaleDB hypertables and native Postgres partitions

## Monitoring

Check view refresh status:

```typescript
const status = materializedViewsService.getRefreshStatus();
console.log(status);
```

## Troubleshooting

### View refresh is slow

- Check if concurrent refresh is supported (requires unique index)
- Consider reducing retention window
- Verify indexes exist on base tables

### View is missing data

- Check that event_time and ingest_time fields are populated
- Verify base table indexes are up to date
- Check refresh schedule and last refresh time

### High database load

- Reduce refresh frequency for low-priority views
- Consider using non-concurrent refresh during off-peak hours
- Review query patterns and add specific indexes
