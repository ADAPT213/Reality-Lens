import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

interface EWMAState {
  value: number;
  timestamp: Date;
}

interface AnomalyDetection {
  isAnomaly: boolean;
  zScore: number;
  baseline: number;
  stdDev: number;
  confidence: number;
}

interface RiskForecast {
  timestamp: Date;
  horizon: number;
  predictedRisk: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

interface ThresholdCrossing {
  expectedTime: Date;
  threshold: number;
  probability: number;
}

@Injectable()
export class PredictiveService {
  private readonly logger = new Logger(PredictiveService.name);
  private readonly EWMA_ALPHA = 0.3;
  private readonly CONFIDENCE_LEVEL = 1.96;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async calculateEWMA(warehouseId: string, workerId?: string, zoneId?: string): Promise<number> {
    const redis = this.redis.getPublisher();
    const key = this.getEWMAKey(warehouseId, workerId, zoneId);

    const now = new Date();
    const since = new Date(now.getTime() - 60 * 60 * 1000);

    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        zoneId: zoneId || undefined,
        timestamp: { gte: since },
        compositeRisk: { not: null },
      },
      orderBy: { timestamp: 'asc' },
      select: { compositeRisk: true, timestamp: true },
    });

    if (snapshots.length === 0) {
      return 0;
    }

    let prevState: EWMAState | null = null;
    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        prevState = JSON.parse(cached);
      }
    }

    let ewma = prevState?.value || Number(snapshots[0].compositeRisk);

    for (const snapshot of snapshots) {
      const value = Number(snapshot.compositeRisk);
      ewma = this.EWMA_ALPHA * value + (1 - this.EWMA_ALPHA) * ewma;
    }

    if (redis) {
      const state: EWMAState = { value: ewma, timestamp: now };
      await redis.setex(key, 3600, JSON.stringify(state));
    }

    return ewma;
  }

  async forecastRisk(
    warehouseId: string,
    horizonMinutes: number = 10,
    zoneId?: string,
  ): Promise<RiskForecast[]> {
    const now = new Date();
    const lookback = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        zoneId: zoneId || undefined,
        timestamp: { gte: lookback },
        compositeRisk: { not: null },
      },
      orderBy: { timestamp: 'asc' },
      select: { compositeRisk: true, timestamp: true },
    });

    if (snapshots.length < 10) {
      return [];
    }

    const values = snapshots.map((s) => Number(s.compositeRisk));
    const ewma = await this.calculateEWMA(warehouseId, undefined, zoneId);

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const trend = this.calculateTrend(snapshots);

    const forecasts: RiskForecast[] = [];
    for (let h = 5; h <= horizonMinutes; h += 5) {
      const predictedRisk = ewma + trend * h;
      const uncertainty = stdDev * Math.sqrt(h / 5);
      const confidence = Math.max(0.5, 1 - uncertainty / predictedRisk);

      forecasts.push({
        timestamp: new Date(now.getTime() + h * 60 * 1000),
        horizon: h,
        predictedRisk: Math.max(0, predictedRisk),
        confidence,
        upperBound: predictedRisk + this.CONFIDENCE_LEVEL * uncertainty,
        lowerBound: Math.max(0, predictedRisk - this.CONFIDENCE_LEVEL * uncertainty),
      });
    }

    return forecasts;
  }

  async detectAnomalies(
    warehouseId: string,
    zoneId?: string,
    workerId?: string,
  ): Promise<AnomalyDetection> {
    const baseline = await this.getBaseline(warehouseId, zoneId, workerId);
    const current = await this.calculateEWMA(warehouseId, workerId, zoneId);

    const zScore = Math.abs((current - baseline.mean) / baseline.stdDev);
    const isAnomaly = zScore > 2.5;
    const confidence = Math.min(1, zScore / 3);

    return {
      isAnomaly,
      zScore,
      baseline: baseline.mean,
      stdDev: baseline.stdDev,
      confidence,
    };
  }

  async predictThresholdCrossing(
    warehouseId: string,
    threshold: number,
    zoneId?: string,
  ): Promise<ThresholdCrossing | null> {
    const forecasts = await this.forecastRisk(warehouseId, 10, zoneId);

    for (const forecast of forecasts) {
      if (forecast.predictedRisk >= threshold) {
        return {
          expectedTime: forecast.timestamp,
          threshold,
          probability: forecast.confidence,
        };
      }
    }

    return null;
  }

  async storePrediction(
    warehouseId: string,
    prediction: RiskForecast,
    featuresUsed: Record<string, any>,
    zoneId?: string,
  ): Promise<void> {
    const redis = this.redis.getPublisher();
    if (!redis) return;

    const key = `prediction:${warehouseId}:${zoneId || 'all'}:${prediction.timestamp.getTime()}`;
    const data = {
      warehouseId,
      zoneId,
      eventTime: new Date(),
      horizon: prediction.horizon,
      predictedRisk: prediction.predictedRisk,
      confidence: prediction.confidence,
      upperBound: prediction.upperBound,
      lowerBound: prediction.lowerBound,
      featuresUsed,
      actualOutcome: null,
    };

    await redis.setex(key, 86400, JSON.stringify(data));
  }

  private calculateTrend(snapshots: Array<{ compositeRisk: any; timestamp: Date }>): number {
    if (snapshots.length < 2) return 0;

    const recent = snapshots.slice(-10);
    const values = recent.map((s) => Number(s.compositeRisk));

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;
    const n = values.length;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private async getBaseline(
    warehouseId: string,
    zoneId?: string,
    workerId?: string,
  ): Promise<{ mean: number; stdDev: number }> {
    const redis = this.redis.getPublisher();
    const key = `baseline:${warehouseId}:${zoneId || 'all'}:${workerId || 'all'}`;

    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const lookback = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        zoneId: zoneId || undefined,
        timestamp: { gte: lookback },
        compositeRisk: { not: null },
      },
      select: { compositeRisk: true },
    });

    if (snapshots.length === 0) {
      return { mean: 0, stdDev: 1 };
    }

    const values = snapshots.map((s) => Number(s.compositeRisk));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const baseline = { mean, stdDev: stdDev || 1 };

    if (redis) {
      await redis.setex(key, 3600, JSON.stringify(baseline));
    }

    return baseline;
  }

  private getEWMAKey(warehouseId: string, workerId?: string, zoneId?: string): string {
    return `ewma:${warehouseId}:${zoneId || 'all'}:${workerId || 'all'}`;
  }
}
