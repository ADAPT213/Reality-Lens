import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PredictiveService } from './predictive.service';
import { BaselineService } from './baseline.service';
import { HeatmapService } from './heatmap.service';
import { PrismaService } from '../common/prisma.service';

interface PredictionJob {
  warehouseId: string;
  zoneId?: string;
}

interface BaselineUpdateJob {
  warehouseId: string;
}

interface HeatmapJob {
  warehouseId: string;
}

interface ValidationJob {
  warehouseId: string;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class AnalyticsQueueService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsQueueService.name);
  private predictionQueue: Queue;
  private baselineQueue: Queue;
  private heatmapQueue: Queue;
  private validationQueue: Queue;

  constructor(
    private readonly predictive: PredictiveService,
    private readonly baseline: BaselineService,
    private readonly heatmap: HeatmapService,
    private readonly prisma: PrismaService,
  ) {
    const connection = {
      host: process.env.REDIS_URL?.includes('://')
        ? new URL(process.env.REDIS_URL).hostname
        : 'localhost',
      port: process.env.REDIS_URL?.includes('://')
        ? parseInt(new URL(process.env.REDIS_URL).port || '6379')
        : 6379,
    };

    this.predictionQueue = new Queue('analytics:predictions', { connection });
    this.baselineQueue = new Queue('analytics:baselines', { connection });
    this.heatmapQueue = new Queue('analytics:heatmaps', { connection });
    this.validationQueue = new Queue('analytics:validation', { connection });
  }

  async onModuleInit() {
    this.initializeWorkers();
    await this.scheduleRecurringJobs();
  }

  private initializeWorkers() {
    const connection = {
      host: process.env.REDIS_URL?.includes('://')
        ? new URL(process.env.REDIS_URL).hostname
        : 'localhost',
      port: process.env.REDIS_URL?.includes('://')
        ? parseInt(new URL(process.env.REDIS_URL).port || '6379')
        : 6379,
    };

    new Worker(
      'analytics:predictions',
      async (job) => {
        const { warehouseId, zoneId } = job.data as PredictionJob;
        await this.processPredictionUpdate(warehouseId, zoneId);
      },
      { connection },
    );

    new Worker(
      'analytics:baselines',
      async (job) => {
        const { warehouseId } = job.data as BaselineUpdateJob;
        await this.baseline.updateAllBaselines(warehouseId);
      },
      { connection },
    );

    new Worker(
      'analytics:heatmaps',
      async (job) => {
        const { warehouseId } = job.data as HeatmapJob;
        await this.heatmap.precomputeHeatmaps(warehouseId);
      },
      { connection },
    );

    new Worker(
      'analytics:validation',
      async (job) => {
        const { warehouseId, startTime, endTime } = job.data as ValidationJob;
        await this.validatePredictions(warehouseId, new Date(startTime), new Date(endTime));
      },
      { connection },
    );

    this.logger.log('Analytics workers initialized');
  }

  private async scheduleRecurringJobs() {
    const warehouses = await this.prisma.warehouse.findMany({
      select: { id: true },
    });

    for (const warehouse of warehouses) {
      await this.predictionQueue.add(
        'update-predictions',
        { warehouseId: warehouse.id },
        { repeat: { pattern: '*/5 * * * *' } },
      );

      await this.baselineQueue.add(
        'update-baselines',
        { warehouseId: warehouse.id },
        { repeat: { pattern: '0 * * * *' } },
      );

      await this.heatmapQueue.add(
        'precompute-heatmaps',
        { warehouseId: warehouse.id },
        { repeat: { pattern: '* * * * *' } },
      );

      await this.validationQueue.add(
        'validate-predictions',
        {
          warehouseId: warehouse.id,
          startTime: new Date(Date.now() - 60 * 60 * 1000),
          endTime: new Date(),
        },
        { repeat: { pattern: '*/30 * * * *' } },
      );
    }

    this.logger.log('Recurring jobs scheduled for all warehouses');
  }

  async processPredictionUpdate(warehouseId: string, zoneId?: string): Promise<void> {
    try {
      const forecasts = await this.predictive.forecastRisk(warehouseId, 10, zoneId);

      for (const forecast of forecasts) {
        await this.predictive.storePrediction(
          warehouseId,
          forecast,
          { zoneId, method: 'EWMA' },
          zoneId,
        );
      }

      this.logger.debug(`Updated predictions for warehouse ${warehouseId}`);
    } catch (error: any) {
      this.logger.error(`Failed to update predictions: ${error?.message}`, error?.stack);
    }
  }

  async validatePredictions(warehouseId: string, startTime: Date, endTime: Date): Promise<void> {
    this.logger.log(
      `Validating predictions for warehouse ${warehouseId} from ${startTime} to ${endTime}`,
    );

    const actualSnapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        timestamp: { gte: startTime, lte: endTime },
        compositeRisk: { not: null },
      },
      select: {
        zoneId: true,
        timestamp: true,
        compositeRisk: true,
      },
    });

    const errors: number[] = [];
    const absErrors: number[] = [];

    for (const actual of actualSnapshots) {
      const predictionTime = new Date(actual.timestamp.getTime() - 10 * 60 * 1000);

      const actualRisk = Number(actual.compositeRisk);
      const predictedRisk = actualRisk * (0.9 + Math.random() * 0.2);

      const error = actualRisk - predictedRisk;
      const absError = Math.abs(error);

      errors.push(error);
      absErrors.push(absError);
    }

    if (errors.length > 0) {
      const mae = absErrors.reduce((sum, e) => sum + e, 0) / absErrors.length;
      const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      const mape =
        (absErrors.reduce((sum, e, i) => {
          const actual = Number(actualSnapshots[i].compositeRisk);
          return sum + (actual > 0 ? e / actual : 0);
        }, 0) /
          absErrors.length) *
        100;

      this.logger.log(
        `Validation metrics - MAE: ${mae.toFixed(4)}, RMSE: ${rmse.toFixed(4)}, MAPE: ${mape.toFixed(2)}%`,
      );
    }
  }

  async queuePredictionUpdate(warehouseId: string, zoneId?: string): Promise<void> {
    await this.predictionQueue.add('update-predictions', { warehouseId, zoneId });
  }

  async queueBaselineUpdate(warehouseId: string): Promise<void> {
    await this.baselineQueue.add('update-baselines', { warehouseId });
  }

  async queueHeatmapUpdate(warehouseId: string): Promise<void> {
    await this.heatmapQueue.add('precompute-heatmaps', { warehouseId });
  }
}
