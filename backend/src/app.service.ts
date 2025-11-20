import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from './common/dto/health-response.dto';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';

@Injectable()
export class AppService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  getHealth(): HealthResponseDto {
    const dbStatus = this.checkDatabaseHealth();
    const redisStatus = this.checkRedisHealth();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }

  private checkDatabaseHealth(): string {
    try {
      return this.prisma ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  private checkRedisHealth(): string {
    const pub = this.redis.getPublisher();
    return pub && pub.status === 'ready' ? 'available' : 'unavailable';
  }
}
