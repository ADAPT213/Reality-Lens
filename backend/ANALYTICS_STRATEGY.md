# Predictive Analytics Strategy

## Forecasting Approach

### 1. EWMA (Exponentially Weighted Moving Average)

- **Alpha Parameter**: 0.3 (balances responsiveness vs stability)
- **State Persistence**: Cached in Redis with 1-hour TTL
- **Application**: Tracks real-time risk trends per warehouse/zone/worker
- **Formula**: `EWMA_t = α × value_t + (1-α) × EWMA_(t-1)`

### 2. Linear Trend Estimation

- **Method**: Simple linear regression on last 10 snapshots
- **Purpose**: Captures short-term directional movement
- **Integration**: Added to EWMA baseline for forecast

### 3. Uncertainty Quantification

- **Confidence Intervals**: 95% (z=1.96)
- **Expanding Uncertainty**: Grows with sqrt(horizon) to reflect increasing prediction variance
- **Confidence Score**: Calculated as `1 - (uncertainty / predicted_risk)`

### 4. Forecast Horizons

- **Range**: 5-10 minutes ahead
- **Resolution**: 5-minute intervals
- **Updates**: Every 5 minutes via BullMQ
- **Output**: Predicted risk, upper/lower bounds, confidence

### 5. Threshold Crossing Prediction

- **Purpose**: Alert supervisors 5-10 minutes before risk exceeds threshold
- **Method**: Scan forecasts for first threshold breach
- **Probability**: Based on forecast confidence at crossing point

## Anomaly Detection

### 1. Baseline Calculation

- **Rolling Window**: 168 hours (7 days)
- **Segments**: By warehouse, zone, shift
- **Metrics**: Mean, median, p95, standard deviation
- **Cache**: Redis with 1-hour TTL
- **Updates**: Hourly via scheduled job

### 2. Z-Score Detection

- **Threshold**: |z| > 2.5 (99% confidence)
- **Formula**: `z = (current - baseline_mean) / baseline_stdDev`
- **Confidence**: Normalized z-score (capped at 1.0)

### 3. Contextual Baselines

- **Per-Worker**: Individual performance patterns
- **Per-Zone**: Spatial risk characteristics
- **Per-Shift**: Temporal patterns (morning/afternoon/night)

## Accuracy Tracking

### 1. Prediction Storage

- **Medium**: Redis with 24-hour TTL
- **Key Structure**: `prediction:{warehouseId}:{zoneId}:{timestamp}`
- **Contents**: Prediction metadata, features used, actual outcome (backfilled)

### 2. Validation Job

- **Frequency**: Every 30 minutes
- **Lookback**: Previous hour
- **Process**:
  1. Fetch predictions made 10 minutes before actual events
  2. Compare predicted vs actual composite risk
  3. Calculate error metrics

### 3. Error Metrics

#### Mean Absolute Error (MAE)

```
MAE = Σ|actual - predicted| / n
```

- **Interpretation**: Average prediction error in risk units
- **Target**: < 0.1 (10% of typical risk range)

#### Root Mean Square Error (RMSE)

```
RMSE = sqrt(Σ(actual - predicted)² / n)
```

- **Interpretation**: Penalizes large errors more heavily
- **Target**: < 0.15

#### Mean Absolute Percentage Error (MAPE)

```
MAPE = (Σ|actual - predicted| / actual) / n × 100%
```

- **Interpretation**: Percentage error relative to actual values
- **Target**: < 15%

### 4. Model Drift Detection

- **Weekly Comparison**: Compare current week MAE vs previous 4 weeks
- **Threshold**: Alert if MAE increases >25%
- **Action**: Flag for model recalibration

### 5. Segmented Performance

- **By Warehouse**: Track accuracy per facility
- **By Zone**: Identify zones with poor prediction
- **By Time of Day**: Detect temporal patterns in errors
- **By Risk Level**: Separate metrics for low/medium/high risk

## Heatmap Generation

### 1. Spatial Binning

- **Grid Size**: 50cm × 50cm (configurable)
- **Method**: Floor division of coordinates into cells
- **Aggregation**: Risk density = avg_risk × log(exposure_count + 1)

### 2. Hotspot Identification

- **Threshold**: Average risk ≥ 0.7
- **Clustering**: ≥3 adjacent high-risk cells
- **Radius**: 1.5× grid size
- **Deduplication**: Merge overlapping hotspots

### 3. Severity Scoring

```
score = avg_risk × log(exposure_count + 1)

critical: score ≥ 3
high:     score ≥ 2
medium:   score ≥ 1
low:      score < 1
```

### 4. Precomputation

- **Frequency**: Every 1 minute
- **Scope**: Warehouse-level + per-zone
- **Cache**: Redis with 60-second TTL
- **Update**: BullMQ scheduled job

## Scheduled Jobs

### BullMQ Queue Configuration

| Queue                   | Job                  | Frequency    | Purpose                        |
| ----------------------- | -------------------- | ------------ | ------------------------------ |
| `analytics:predictions` | Update forecasts     | Every 5 min  | Generate 5-10 min forecasts    |
| `analytics:baselines`   | Update baselines     | Every hour   | Recalculate rolling statistics |
| `analytics:heatmaps`    | Precompute heatmaps  | Every 1 min  | Spatial risk density           |
| `analytics:validation`  | Validate predictions | Every 30 min | Track forecast accuracy        |

## API Endpoints

```
GET /analytics/predictions/:warehouseId
    ?zoneId=<uuid>
    ?horizon=10
    → Returns forecasts for next 5-10 minutes

GET /analytics/forecast/:zoneId
    → Returns 10-min forecast + threshold crossing prediction

GET /analytics/anomalies
    ?warehouseId=<uuid>
    ?zoneId=<uuid>
    → Returns current anomaly status with z-score

GET /analytics/baseline/:warehouseId
    ?zoneId=<uuid>
    ?shiftCode=<code>
    → Returns baseline statistics

GET /analytics/heatmap/:warehouseId
    ?zoneId=<uuid>
    ?gridSize=50
    → Returns spatial heatmap + hotspots

GET /analytics/hotspots/:warehouseId
    ?zoneId=<uuid>
    → Returns identified hotspot zones
```

## Performance Considerations

### 1. Redis Caching Strategy

- **EWMA State**: 1-hour TTL, updated on compute
- **Baselines**: 1-hour TTL, refreshed hourly
- **Heatmaps**: 60-second TTL, refreshed per minute
- **Predictions**: 24-hour TTL for validation

### 2. Database Query Optimization

- **Indexes**: `eventTime DESC` on ergonomic_snapshots
- **Lookback Limits**:
  - EWMA: 1 hour
  - Forecasting: 2 hours
  - Baselines: 7 days
- **Result Limits**: Return top N results for heatmaps/hotspots

### 3. Concurrency

- **BullMQ Workers**: Parallel processing of warehouses
- **Per-Warehouse**: Sequential zone processing
- **Error Handling**: Graceful degradation if Redis unavailable

## Future Enhancements

1. **Machine Learning Models**
   - Replace EWMA with LSTM/GRU for non-linear patterns
   - Feature engineering: time-of-day, day-of-week, worker fatigue

2. **Multivariate Forecasting**
   - Combine RULA, REBA, NIOSH into joint prediction
   - Cross-zone influence modeling

3. **Adaptive Hyperparameters**
   - Auto-tune EWMA alpha based on forecast accuracy
   - Dynamic baseline windows per zone

4. **Real-Time Alerts**
   - WebSocket push when threshold crossing predicted
   - Integration with alerts module

5. **Visualization**
   - Frontend heatmap overlays on warehouse layout
   - Time-series charts with forecast bands
