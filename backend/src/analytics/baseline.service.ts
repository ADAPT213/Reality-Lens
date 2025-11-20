import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

interface BaselineStats {
  warehouseId: string;
  zoneId?: string;
  shiftCode?: string;
  workerId?: string;
  mean: number;
  median: number;
  p95: number;
  stdDev: number;
  count: number;
  startTime: Date;
  endTime: Date;
}

interface RollingWindow {
  hourly: BaselineStats[];
  daily: BaselineStats[];
  weekly: BaselineStats[];
}

@Injectable()
export class BaselineService {
  private readonly logger = new Logger(BaselineService.name);
  private readonly ROLLING_WINDOW_HOURS = 168;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async calculateRollingBaseline(
    warehouseId: string,
    zoneId?: string,
    shiftCode?: string,
  ): Promise<BaselineStats> {
    const now = new Date();
    const since = new Date(now.getTime() - this.ROLLING_WINDOW_HOURS * 60 * 60 * 1000);

    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        zoneId: zoneId || undefined,
        shiftCode: shiftCode || undefined,
        timestamp: { gte: since },
        compositeRisk: { not: null },
      },
      orderBy: { timestamp: 'asc' },
      select: { compositeRisk: true, timestamp: true },
    });

    if (snapshots.length === 0) {
      return this.getEmptyBaseline(warehouseId, zoneId, shiftCode, since, now);
    }

    const values = snapshots.map((s) => Number(s.compositeRisk)).sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = this.calculateMedian(values);
    const p95 = this.calculatePercentile(values, 95);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const baseline: BaselineStats = {
      warehouseId,
      zoneId,
      shiftCode,
      mean,
      median,
      p95,
      stdDev,
      count: values.length,
      startTime: since,
      endTime: now,
    };

    await this.cacheBaseline(baseline);
    return baseline;
  }

  async calculateBaselinesByZone(warehouseId: string): Promise<BaselineStats[]> {
    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: { id: true },
    });

    const baselines = await Promise.all(
      zones.map((zone) => this.calculateRollingBaseline(warehouseId, zone.id)),
    );

    return baselines;
  }

  async calculateBaselinesByShift(
    warehouseId: string,
    shiftCodes: string[],
  ): Promise<BaselineStats[]> {
    const baselines = await Promise.all(
      shiftCodes.map((shiftCode) =>
        this.calculateRollingBaseline(warehouseId, undefined, shiftCode),
      ),
    );

    return baselines;
  }

  async getBaseline(
    warehouseId: string,
    zoneId?: string,
    shiftCode?: string,
  ): Promise<BaselineStats | null> {
    const redis = this.redis.getPublisher();
    const key = this.getBaselineKey(warehouseId, zoneId, shiftCode);

    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    return await this.calculateRollingBaseline(warehouseId, zoneId, shiftCode);
  }

  async updateAllBaselines(warehouseId: string): Promise<void> {
    this.logger.log(`Updating baselines for warehouse ${warehouseId}`);

    await this.calculateRollingBaseline(warehouseId);

    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: { id: true },
    });

    for (const zone of zones) {
      await this.calculateRollingBaseline(warehouseId, zone.id);
    }

    const shifts = await this.prisma.ergonomicSnapshot.groupBy({
      by: ['shiftCode'],
      where: {
        warehouseId,
        shiftCode: { not: null },
        timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    for (const shift of shifts) {
      if (shift.shiftCode) {
        await this.calculateRollingBaseline(warehouseId, undefined, shift.shiftCode);
      }
    }

    this.logger.log(`Completed baseline updates for warehouse ${warehouseId}`);
  }

  async compareToBaseline(
    warehouseId: string,
    currentRisk: number,
    zoneId?: string,
    shiftCode?: string,
  ): Promise<{
    deviation: number;
    deviationPercent: number;
    zScore: number;
    exceedsP95: boolean;
  }> {
    const baseline = await this.getBaseline(warehouseId, zoneId, shiftCode);

    if (!baseline || baseline.count === 0) {
      return {
        deviation: 0,
        deviationPercent: 0,
        zScore: 0,
        exceedsP95: false,
      };
    }

    const deviation = currentRisk - baseline.mean;
    const deviationPercent = baseline.mean > 0 ? (deviation / baseline.mean) * 100 : 0;
    const zScore = baseline.stdDev > 0 ? deviation / baseline.stdDev : 0;
    const exceedsP95 = currentRisk > baseline.p95;

    return {
      deviation,
      deviationPercent,
      zScore,
      exceedsP95,
    };
  }

  private async cacheBaseline(baseline: BaselineStats): Promise<void> {
    const redis = this.redis.getPublisher();
    if (!redis) return;

    const key = this.getBaselineKey(baseline.warehouseId, baseline.zoneId, baseline.shiftCode);

    await redis.setex(key, 3600, JSON.stringify(baseline));
  }

  private getBaselineKey(warehouseId: string, zoneId?: string, shiftCode?: string): string {
    return `baseline:${warehouseId}:${zoneId || 'all'}:${shiftCode || 'all'}`;
  }

  private calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
      return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }
    return sortedValues[mid];
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private getEmptyBaseline(
    warehouseId: string,
    zoneId?: string,
    shiftCode?: string,
    startTime?: Date,
    endTime?: Date,
  ): BaselineStats {
    return {
      warehouseId,
      zoneId,
      shiftCode,
      mean: 0,
      median: 0,
      p95: 0,
      stdDev: 0,
      count: 0,
      startTime: startTime || new Date(),
      endTime: endTime || new Date(),
    };
  }
}
