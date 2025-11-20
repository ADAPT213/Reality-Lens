import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { otelConfig } from '../config/otel.config';

let sdk: NodeSDK | null = null;

export function initializeTracing() {
  if (!otelConfig.tracing.enabled) {
    console.log('OpenTelemetry tracing disabled');
    return;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: otelConfig.serviceName,
    [ATTR_SERVICE_VERSION]: otelConfig.serviceVersion,
    'deployment.environment': otelConfig.environment,
  });

  const traceExporter =
    otelConfig.environment === 'development'
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({
          url: `${otelConfig.otlpEndpoint}/v1/traces`,
          headers: parseHeaders(otelConfig.otlpHeaders),
        });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingPaths: ['/health', '/metrics'],
        },
      }),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry tracing initialized');
}

export async function shutdownTracing() {
  if (sdk) {
    await sdk.shutdown();
    console.log('OpenTelemetry tracing shutdown');
  }
}

function parseHeaders(headersStr: string): Record<string, string> {
  if (!headersStr) return {};
  const headers: Record<string, string> = {};
  headersStr.split(',').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key && value) headers[key.trim()] = value.trim();
  });
  return headers;
}

export const tracer = trace.getTracer(otelConfig.serviceName, otelConfig.serviceVersion);

export interface SpanAttributes {
  warehouse_id?: string;
  event_id?: string;
  user_id?: string;
  sku_id?: string;
  zone_id?: string;
  alert_id?: string;
  [key: string]: string | number | boolean | undefined;
}

export async function traceAsync<T>(
  spanName: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function traceSync<T>(
  spanName: string,
  attributes: SpanAttributes,
  fn: (span: Span) => T,
): T {
  return tracer.startActiveSpan(spanName, (span) => {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });

    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function getCurrentTraceId(): string | undefined {
  const activeSpan = trace.getActiveSpan();
  return activeSpan?.spanContext().traceId;
}

export function getCurrentSpanId(): string | undefined {
  const activeSpan = trace.getActiveSpan();
  return activeSpan?.spanContext().spanId;
}

export function injectTraceContext(): Record<string, string> {
  const headers: Record<string, string> = {};
  const activeContext = context.active();

  trace.getSpan(activeContext)?.spanContext();

  return headers;
}
