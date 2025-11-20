import { Module } from '@nestjs/common';
import { PredictiveService } from './predictive.service';
import { BaselineService } from './baseline.service';
import { HeatmapService } from './heatmap.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsQueueService } from './analytics-queue.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    PredictiveService,
    BaselineService,
    HeatmapService,
    AnalyticsQueueService,
    PrismaService,
    RedisService,
  ],
  exports: [PredictiveService, BaselineService, HeatmapService, AnalyticsQueueService],
})
export class AnalyticsModule {}
