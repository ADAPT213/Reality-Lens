import * as winston from 'winston';
import { getCurrentTraceId, getCurrentSpanId } from './tracing';
import { otelConfig } from '../config/otel.config';

const correlationFormat = winston.format((info) => {
  if (otelConfig.logging.correlationEnabled) {
    const traceId = getCurrentTraceId();
    const spanId = getCurrentSpanId();

    if (traceId) info.trace_id = traceId;
    if (spanId) info.span_id = spanId;
  }

  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    correlationFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: otelConfig.serviceName,
    version: otelConfig.serviceVersion,
    environment: otelConfig.environment,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, trace_id, span_id, ...meta }) => {
          const traceInfo = trace_id
            ? ` [trace:${trace_id.slice(0, 8)}${span_id ? ` span:${span_id.slice(0, 8)}` : ''}]`
            : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}${traceInfo}: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  );
}

export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}
