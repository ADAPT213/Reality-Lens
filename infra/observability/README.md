# SmartPick AI Observability

## Architecture Overview

The SmartPick AI platform implements comprehensive observability using OpenTelemetry across all services:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Backend    │────▶│   Frontend   │────▶│Vision Service│
│  (NestJS)    │     │  (Next.js)   │     │  (Python)    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  Traces/Metrics    │  Traces            │  Traces/Metrics
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│            OpenTelemetry Collector (Optional)            │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
           ▼                          ▼
    ┌─────────────┐           ┌─────────────┐
    │  Jaeger     │           │ Prometheus  │
    │  (Traces)   │           │  (Metrics)  │
    └─────────────┘           └──────┬──────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │   Grafana   │
                              │ (Dashboard) │
                              └─────────────┘
```

## Key Metrics Exposed

### Backend (NestJS) - Port 9464

**RED Metrics:**
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request latency (p50, p95, p99)
- `http_request_errors_total` - HTTP errors by type

**Business Metrics:**
- `alerts_created_total` - Alerts by type and severity
- `alerts_per_minute` - Alert creation rate
- `risk_score_distribution` - Distribution of ergonomic risk scores
- `websocket_connections_active` - Active WebSocket connections

**Infrastructure:**
- `queue_depth` - Message queue depth
- `processing_lag_seconds` - Processing lag time
- `db_query_duration_seconds` - Database query latency
- `db_connections_active` - Active DB connections
- `redis_operation_duration_seconds` - Redis operation latency

**AI/ML:**
- `ai_inference_duration_seconds` - AI inference latency
- `ai_inference_tokens` - Token usage per inference

### Vision Service (Python) - Port 9465

- `inference_duration_seconds` - Model inference latency by model
- `inference_requests_total` - Total inference requests
- `inference_errors_total` - Inference errors by type
- `model_load_duration_seconds` - Model loading time
- `frame_processing_duration_seconds` - Frame processing latency
- `ergonomic_score_distribution` - Ergonomic score distribution
- `gpu_utilization` - GPU utilization percentage
- `gpu_memory_used` - GPU memory usage in MB

## Trace Attributes

All services add contextual attributes to traces:

**Common:**
- `service.name` - Service identifier
- `service.version` - Version number
- `deployment.environment` - Environment (dev/staging/prod)

**Backend-specific:**
- `warehouse_id` - Warehouse identifier
- `event_id` - Event identifier
- `user_id` - User identifier
- `sku_id` - SKU identifier
- `zone_id` - Zone identifier
- `alert_id` - Alert identifier

## Setup Instructions

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-prometheus
```

**Frontend:**
```bash
cd frontend
npm install @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/auto-instrumentations-web @opentelemetry/exporter-trace-otlp-http
```

**Vision Service:**
```bash
cd vision-service
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http opentelemetry-instrumentation-fastapi prometheus-client
```

### 2. Configure Environment Variables

Create `.env` files or set environment variables:

```bash
# Backend
OTEL_SERVICE_NAME=smartpick-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
PROMETHEUS_PORT=9464
OTEL_TRACING_ENABLED=true
OTEL_METRICS_ENABLED=true
LOG_CORRELATION_ENABLED=true

# Vision Service
OTEL_SERVICE_NAME=smartpick-vision
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
PROMETHEUS_PORT=9465
ENVIRONMENT=development
```

### 3. Initialize Observability in Services

**Backend (`src/main.ts`):**
```typescript
import { initializeTracing, shutdownTracing } from './observability/tracing';
import { initializeMetrics, shutdownMetrics } from './observability/metrics';

async function bootstrap() {
  initializeTracing();
  initializeMetrics();
  
  // ... existing app initialization
  
  process.on('SIGTERM', async () => {
    await shutdownTracing();
    await shutdownMetrics();
  });
}
```

**Vision Service (`src/main.py`):**
```python
from observability.tracing import initialize_tracing, shutdown_tracing
from observability.metrics import initialize_metrics, shutdown_metrics

@app.on_event("startup")
async def startup():
    initialize_tracing()
    initialize_metrics()

@app.on_event("shutdown")
async def shutdown():
    shutdown_tracing()
    shutdown_metrics()
```

### 4. Run Observability Stack (Docker)

```bash
# Start Prometheus, Jaeger, and Grafana
docker-compose -f infra/observability/docker-compose.yml up -d
```

### 5. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Jaeger UI**: http://localhost:16686
- **Grafana**: http://localhost:3000 (admin/admin)

Import `dashboard.json` into Grafana for the SmartPick dashboard.

## Usage Examples

### Backend Tracing

```typescript
import { traceAsync } from './observability/tracing';
import { recordAlert } from './observability/metrics';

async function processAlert(alertData) {
  return traceAsync('process_alert', {
    warehouse_id: alertData.warehouseId,
    alert_type: alertData.type,
    severity: alertData.severity,
  }, async (span) => {
    // Your logic here
    recordAlert({ 
      alert_type: alertData.type,
      severity: alertData.severity 
    });
    
    return result;
  });
}
```

### Vision Service Tracing

```python
from observability.tracing import trace_span
from observability.metrics import record_inference

async def analyze_frame(frame_data):
    with trace_span("analyze_frame", {"frame_id": frame_data.id}):
        start = time.time()
        result = model.predict(frame_data)
        duration = time.time() - start
        
        record_inference(duration, "pose-estimation", success=True)
        return result
```

## Correlation IDs

All logs include `trace_id` and `span_id` for correlation:

```json
{
  "timestamp": "2025-11-17T10:30:00Z",
  "level": "INFO",
  "message": "Alert created",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "warehouse_id": "WH-001",
  "alert_type": "ERGONOMIC_RISK"
}
```

## Alerting Rules

Key alerts configured in Grafana:

1. **High Error Rate**: Triggers when error rate > 10 req/s for 5 minutes
2. **High Processing Lag**: Triggers when lag > 30 seconds
3. **Service Down**: Triggers when service metrics not received for 2 minutes

## Best Practices

1. **Sampling**: Use trace sampling in production (configured via `OTEL_TRACE_SAMPLE_RATE`)
2. **Cardinality**: Limit metric label cardinality (avoid user IDs in metrics)
3. **Sensitive Data**: Never log/trace PII or secrets
4. **Correlation**: Always propagate trace context across service boundaries
5. **Dashboard**: Keep dashboard panels focused on actionable metrics

## Troubleshooting

### Metrics not appearing
- Check Prometheus scrape targets: http://localhost:9090/targets
- Verify service ports (9464, 9465) are accessible
- Check `OTEL_METRICS_ENABLED=true` in environment

### Traces not showing
- Verify OTLP endpoint is accessible
- Check Jaeger UI for service name
- Ensure `OTEL_TRACING_ENABLED=true`

### High cardinality warnings
- Review metric labels - remove high-cardinality fields
- Use trace attributes for detailed context instead of metric labels
