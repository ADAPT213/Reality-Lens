import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { metrics, Counter, Histogram, ObservableGauge } from '@opentelemetry/api';
import { otelConfig } from '../config/otel.config';

let meterProvider: MeterProvider | null = null;
let prometheusExporter: PrometheusExporter | null = null;

export function initializeMetrics() {
  if (!otelConfig.metrics.enabled) {
    console.log('OpenTelemetry metrics disabled');
    return;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: otelConfig.serviceName,
    [ATTR_SERVICE_VERSION]: otelConfig.serviceVersion,
    'deployment.environment': otelConfig.environment,
  });

  prometheusExporter = new PrometheusExporter({
    port: otelConfig.prometheusPort,
    endpoint: otelConfig.prometheusEndpoint,
  });

  meterProvider = new MeterProvider({
    resource,
    readers: [prometheusExporter],
  });

  metrics.setGlobalMeterProvider(meterProvider);

  console.log(
    `Prometheus metrics exposed at http://localhost:${otelConfig.prometheusPort}${otelConfig.prometheusEndpoint}`,
  );
}

export async function shutdownMetrics() {
  if (prometheusExporter) {
    await prometheusExporter.shutdown();
    console.log('Prometheus exporter shutdown');
  }
}

const meter = metrics.getMeter(otelConfig.serviceName, otelConfig.serviceVersion);

export const httpRequestsTotal = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
  unit: '1',
});

export const httpRequestDuration = meter.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request duration in seconds',
  unit: 's',
});

export const httpRequestErrors = meter.createCounter('http_request_errors_total', {
  description: 'Total number of HTTP request errors',
  unit: '1',
});

export const alertsCreated = meter.createCounter('alerts_created_total', {
  description: 'Total number of alerts created',
  unit: '1',
});

export const alertsPerMinute = meter.createHistogram('alerts_per_minute', {
  description: 'Number of alerts created per minute',
  unit: '1',
});

export const riskScoreHistogram = meter.createHistogram('risk_score_distribution', {
  description: 'Distribution of risk scores',
  unit: '1',
});

export const wsConnectionsActive = meter.createUpDownCounter('websocket_connections_active', {
  description: 'Number of active WebSocket connections',
  unit: '1',
});

export const queueDepth = meter.createObservableGauge('queue_depth', {
  description: 'Current depth of message queue',
  unit: '1',
});

export const processingLag = meter.createObservableGauge('processing_lag_seconds', {
  description: 'Processing lag in seconds',
  unit: 's',
});

export const dbQueryDuration = meter.createHistogram('db_query_duration_seconds', {
  description: 'Database query duration in seconds',
  unit: 's',
});

export const dbConnectionsActive = meter.createUpDownCounter('db_connections_active', {
  description: 'Number of active database connections',
  unit: '1',
});

export const redisOperationDuration = meter.createHistogram('redis_operation_duration_seconds', {
  description: 'Redis operation duration in seconds',
  unit: 's',
});

export const aiInferenceDuration = meter.createHistogram('ai_inference_duration_seconds', {
  description: 'AI inference duration in seconds',
  unit: 's',
});

export const aiInferenceTokens = meter.createHistogram('ai_inference_tokens', {
  description: 'Number of tokens used in AI inference',
  unit: '1',
});

export interface MetricLabels {
  method?: string;
  route?: string;
  status_code?: string;
  error_type?: string;
  warehouse_id?: string;
  alert_type?: string;
  severity?: string;
  operation?: string;
  model?: string;
  [key: string]: string | undefined;
}

export function recordHttpRequest(labels: MetricLabels) {
  httpRequestsTotal.add(1, labels);
}

export function recordHttpRequestDuration(durationSeconds: number, labels: MetricLabels) {
  httpRequestDuration.record(durationSeconds, labels);
}

export function recordHttpError(labels: MetricLabels) {
  httpRequestErrors.add(1, labels);
}

export function recordAlert(labels: MetricLabels) {
  alertsCreated.add(1, labels);
}

export function recordRiskScore(score: number, labels: MetricLabels) {
  riskScoreHistogram.record(score, labels);
}

export function incrementWsConnections(labels: MetricLabels = {}) {
  wsConnectionsActive.add(1, labels);
}

export function decrementWsConnections(labels: MetricLabels = {}) {
  wsConnectionsActive.add(-1, labels);
}

export function recordDbQuery(durationSeconds: number, labels: MetricLabels) {
  dbQueryDuration.record(durationSeconds, labels);
}

export function recordRedisOperation(durationSeconds: number, labels: MetricLabels) {
  redisOperationDuration.record(durationSeconds, labels);
}

export function recordAiInference(durationSeconds: number, tokens: number, labels: MetricLabels) {
  aiInferenceDuration.record(durationSeconds, labels);
  aiInferenceTokens.record(tokens, labels);
}

export function registerQueueDepthCallback(callback: () => number) {
  queueDepth.addCallback((observableResult) => {
    observableResult.observe(callback());
  });
}

export function registerProcessingLagCallback(callback: () => number) {
  processingLag.addCallback((observableResult) => {
    observableResult.observe(callback());
  });
}
