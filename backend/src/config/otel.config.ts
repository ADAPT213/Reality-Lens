export const otelConfig = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'smartpick-backend',
  serviceVersion: process.env.npm_package_version || '0.1.0',
  environment: process.env.NODE_ENV || 'development',

  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  otlpHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS || '',

  prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9464', 10),
  prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',

  tracing: {
    enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
    sampleRate: parseFloat(process.env.OTEL_TRACE_SAMPLE_RATE || '1.0'),
  },

  metrics: {
    enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
    exportInterval: parseInt(process.env.OTEL_METRICS_EXPORT_INTERVAL || '60000', 10),
  },

  logging: {
    correlationEnabled: process.env.LOG_CORRELATION_ENABLED !== 'false',
  },
};

export type OtelConfig = typeof otelConfig;
