import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  recordHttpRequest,
  recordHttpRequestDuration,
  recordHttpError,
  MetricLabels,
} from './metrics';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    const originalSend = res.send;
    res.send = function (body: any) {
      const durationSeconds = (Date.now() - startTime) / 1000;

      const labels: MetricLabels = {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
      };

      recordHttpRequest(labels);
      recordHttpRequestDuration(durationSeconds, labels);

      if (res.statusCode >= 400) {
        recordHttpError({ ...labels, error_type: res.statusCode >= 500 ? 'server' : 'client' });
      }

      return originalSend.call(this, body);
    };

    next();
  }
}
