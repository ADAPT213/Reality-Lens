# SmartPick AI - Observability Architecture

## Overview

SmartPick AI implements **comprehensive observability** using OpenTelemetry across all services, exposing RED metrics (Rate, Errors, Duration), business metrics, and distributed traces with correlation IDs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SmartPick AI Services                        │
├─────────────────┬──────────────────┬─────────────────────────────┤
│   Backend       │    Frontend      │    Vision Service           │
│   (NestJS)      │    (Next.js)     │    (Python/FastAPI)        │
│                 │                  │                             │
│ • Tracing ✓     │ • Tracing ✓      │ • Tracing ✓                │
│ • Metrics ✓     │ • User metrics   │ • Metrics ✓                │
│ • Logging ✓     │                  │ • Logging ✓                │
│                 │                  │                             │
│ Port: 9464      │                  │ Port: 9465                 │
└────────┬────────┴────────┬─────────┴────────┬───────────────────┘
         │                 │                  │
         │  OTLP/HTTP      │  OTLP/HTTP       │  OTLP/HTTP
         │  Prometheus     │  (optional)      │  Prometheus
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              Observability Backend (Docker)                      │
├─────────────────┬──────────────────┬─────────────────────────────┤
│   Jaeger        │   Prometheus     │    Grafana                  │
│   :16686        │   :9090          │    :3000                    │
│                 │                  │                             │
│ • Trace UI      │ • Metrics store  │ • Dashboards               │
│ • Query API     │ • Scraping       │ • Alerting                 │
└─────────────────┴──────────────────┴─────────────────────────────┘
```

## Key Metrics Exposed

### Backend Service (NestJS) - `:9464/metrics`

#### RED Metrics
| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_requests_total` | Counter | Total HTTP requests | method, route, status_code |
| `http_request_duration_seconds` | Histogram | Request latency | method, route, status_code |
| `http_request_errors_total` | Counter | HTTP errors | method, route, error_type |

#### Business Metrics
| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `alerts_created_total` | Counter | Alerts created | alert_type, severity, warehouse_id |
| `alerts_per_minute` | Histogram | Alert rate | warehouse_id |
| `risk_score_distribution` | Histogram | Risk score histogram | warehouse_id, zone_id |
| `websocket_connections_active` | UpDownCounter | Active WS connections | - |

#### Infrastructure Metrics
| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `queue_depth` | Gauge | Message queue depth | - |
| `processing_lag_seconds` | Gauge | Processing lag | - |
| `db_query_duration_seconds` | Histogram | DB query time | operation |
| `db_connections_active` | UpDownCounter | Active DB connections | - |
| `redis_operation_duration_seconds` | Histogram | Redis op time | operation |

#### AI/ML Metrics
| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `ai_inference_duration_seconds` | Histogram | AI inference time | model |
| `ai_inference_tokens` | Histogram | Tokens used | model |

### Vision Service (Python) - `:9465/metrics`

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `inference_duration_seconds` | Histogram | Inference latency | model |
| `inference_requests_total` | Counter | Inference requests | model |
| `inference_errors_total` | Counter | Inference errors | model, error_type |
| `model_load_duration_seconds` | Histogram | Model load time | model |
| `frame_processing_duration_seconds` | Histogram | Frame processing time | - |
| `ergonomic_score_distribution` | Histogram | Ergonomic scores | - |
| `gpu_utilization` | Gauge | GPU utilization % | - |
| `gpu_memory_used` | Gauge | GPU memory MB | - |

## Trace Context Attributes

All services propagate and enrich traces with business context:

**Common Attributes:**
- `service.name`, `service.version`
- `deployment.environment`

**Backend-Specific:**
- `warehouse_id` - Warehouse identifier
- `event_id` - Event identifier  
- `user_id` - User performing action
- `sku_id` - SKU being processed
- `zone_id` - Zone identifier
- `alert_id` - Alert identifier

## Structured Logging with Correlation

All logs include trace correlation:

```json
{
  "timestamp": "2025-11-17T10:30:00.123Z",
  "level": "INFO",
  "service": "smartpick-backend",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "message": "Ergonomic alert created",
  "warehouse_id": "WH-001",
  "alert_type": "HIGH_RISK",
  "severity": "HIGH",
  "risk_score": 87.5
}
```

## Quick Start

### 1. Install Dependencies

**Backend:**
```powershell
cd backend
npm install --save @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-prometheus
```

**Frontend:**
```powershell
cd frontend
npm install --save @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/auto-instrumentations-web @opentelemetry/exporter-trace-otlp-http
```

**Vision Service:**
```powershell
cd vision-service
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http opentelemetry-instrumentation-fastapi prometheus-client
```

### 2. Start Observability Stack

```powershell
cd infra/observability
docker-compose up -d
```

This starts:
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

### 3. Initialize in Services

**Backend** (`src/main.ts`):
```typescript
import { initializeTracing, shutdownTracing } from './observability/tracing';
import { initializeMetrics, shutdownMetrics } from './observability/metrics';

async function bootstrap() {
  // Initialize observability first
  initializeTracing();
  initializeMetrics();
  
  const app = await NestFactory.create(AppModule);
  
  // ... rest of setup
  
  await app.listen(3001);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await shutdownTracing();
    await shutdownMetrics();
    await app.close();
  });
}
```

**Vision Service** (`src/main.py`):
```python
from observability.tracing import initialize_tracing, shutdown_tracing
from observability.metrics import initialize_metrics, shutdown_metrics
from observability.logging import setup_logging

app = FastAPI()
logger = setup_logging()

@app.on_event("startup")
async def startup():
    initialize_tracing()
    initialize_metrics()
    logger.info("Vision service started")

@app.on_event("shutdown")
async def shutdown():
    shutdown_tracing()
    shutdown_metrics()
    logger.info("Vision service stopped")
```

### 4. Import Grafana Dashboard

1. Open http://localhost:3000
2. Login: admin/admin
3. Navigate to Dashboards → Import
4. Upload `infra/observability/dashboard.json`

## Usage Examples

### Backend - Tracing Critical Paths

```typescript
import { traceAsync } from './observability/tracing';
import { recordAlert, recordRiskScore } from './observability/metrics';

export class AlertsService {
  async createErgonomicAlert(data: CreateAlertDto) {
    return traceAsync('create_ergonomic_alert', {
      warehouse_id: data.warehouseId,
      zone_id: data.zoneId,
      user_id: data.userId,
      alert_type: 'ERGONOMIC_RISK',
    }, async (span) => {
      const riskScore = await this.calculateRisk(data);
      
      // Record business metrics
      recordRiskScore(riskScore, { 
        warehouse_id: data.warehouseId,
        zone_id: data.zoneId 
      });
      
      const alert = await this.prisma.alert.create({ data });
      
      recordAlert({ 
        alert_type: 'ERGONOMIC_RISK',
        severity: alert.severity,
        warehouse_id: data.warehouseId 
      });
      
      span.setAttribute('alert_id', alert.id);
      span.setAttribute('risk_score', riskScore);
      
      return alert;
    });
  }
}
```

### Vision Service - Trace Inference Pipeline

```python
from observability.tracing import trace_span
from observability.metrics import record_inference, measure_time

async def analyze_ergonomics(frame_data: bytes):
    with trace_span("analyze_ergonomics", {"frame_size": len(frame_data)}):
        # Measure inference time
        with measure_time("inference", {"model": "pose-estimation"}):
            pose_result = await pose_model.predict(frame_data)
        
        # Calculate risk
        risk_score = calculate_risk_score(pose_result)
        
        record_ergonomic_score(risk_score, {"severity": get_severity(risk_score)})
        
        return {
            "pose": pose_result,
            "risk_score": risk_score,
            "timestamp": time.time()
        }
```

### Database Query Instrumentation

```typescript
import { recordDbQuery } from './observability/metrics';

async function executeQuery(sql: string, params: any[]) {
  const start = Date.now();
  try {
    const result = await this.prisma.$queryRaw(sql, ...params);
    const duration = (Date.now() - start) / 1000;
    
    recordDbQuery(duration, { operation: 'SELECT' });
    return result;
  } catch (error) {
    recordDbQuery((Date.now() - start) / 1000, { 
      operation: 'SELECT',
      error: 'true' 
    });
    throw error;
  }
}
```

## Alerting

Key alerts configured in Grafana:

1. **High Error Rate**: > 10 errors/sec for 5 minutes
2. **High Processing Lag**: > 30 seconds
3. **Service Unavailable**: No metrics for 2 minutes
4. **High Risk Score**: Sustained high ergonomic risk

## Performance Impact

- **Tracing**: ~1-2ms overhead per instrumented operation
- **Metrics**: Negligible (<0.1ms)
- **Sampling**: Configure 10-20% in production via `OTEL_TRACE_SAMPLE_RATE=0.1`

## Troubleshooting

**Metrics not showing in Prometheus:**
```powershell
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify backend metrics endpoint
curl http://localhost:9464/metrics

# Verify vision service metrics
curl http://localhost:9465/metrics
```

**Traces not in Jaeger:**
```powershell
# Check if backend is sending traces
# Look for OTLP endpoint connection in logs

# Verify Jaeger is receiving
curl http://localhost:16686/api/services
```

**Correlation IDs missing:**
```typescript
// Ensure tracing initialized BEFORE logger setup
initializeTracing();  // Must be first
const logger = createLogger();  // Will now include trace_id
```

## Production Considerations

1. **Sampling**: Use 5-10% trace sampling in production
2. **Retention**: Configure Prometheus retention (default 15 days)
3. **Cardinality**: Limit metric labels to avoid cardinality explosion
4. **Security**: Use authentication for Grafana/Prometheus in production
5. **Costs**: Monitor OTLP egress if using managed services

## Next Steps

- [ ] Add custom business metrics for specific workflows
- [ ] Configure alerting rules and notification channels
- [ ] Integrate with log aggregation (Loki, ELK)
- [ ] Add SLO/SLI dashboards
- [ ] Set up anomaly detection
