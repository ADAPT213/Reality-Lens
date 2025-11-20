import { createLogger, format, transports } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack, context }) => {
  const ctx = context ? `[${context}]` : '';
  return `${timestamp} ${level} ${ctx} ${stack || message}`;
});

const baseTransports: any[] = [
  new transports.Console({
    format: combine(colorize(), logFormat),
  }),
];

try {
  if (process.env.NODE_ENV !== 'development') {
    baseTransports.push(
      new (DailyRotateFile as any)({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
      }),
    );
    baseTransports.push(
      new (DailyRotateFile as any)({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
      }),
    );
  }
} catch (e) {
  // Fallback to console-only logging if file transport fails
  // eslint-disable-next-line no-console
  console.warn('[logger] File rotation disabled:', (e as Error).message);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: baseTransports,
});

export default logger;
