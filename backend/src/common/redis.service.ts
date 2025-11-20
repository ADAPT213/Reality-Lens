import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private pub: Redis | null = null;
  private sub: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.pub = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
      this.sub = new Redis(url, { lazyConnect: true, retryStrategy: () => null });

      // Attach silent error handlers to prevent process crash when Redis absent
      [this.pub, this.sub].forEach((client) => {
        client?.on('error', () => {
          /* swallow */
        });
      });

      this.pub.connect().catch(() => {
        this.pub = null;
      });
      this.sub.connect().catch(() => {
        this.sub = null;
      });
    } catch (e) {
      console.warn('Redis unavailable, running without pub/sub');
    }
  }

  getPublisher() {
    return this.pub;
  }

  getSubscriber() {
    return this.sub;
  }
}
