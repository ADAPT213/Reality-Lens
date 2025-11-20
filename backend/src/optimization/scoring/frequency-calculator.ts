import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface FrequencyMetrics {
  totalPicks: number;
  picksPerHour: number;
  peakHourPicks: number;
  hourlyPattern: Record<number, number>;
  normalizedScore: number;
}

@Injectable()
export class FrequencyCalculator {
  constructor(private prisma: PrismaService) {}

  async calculateFrequency(
    skuId: string,
    locationId: string,
    lookbackDays = 30,
  ): Promise<FrequencyMetrics> {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        skuId,
        pickLocationId: locationId,
        fromTs: { gte: lookbackDate },
      },
    });

    if (assignments.length === 0) {
      return {
        totalPicks: 0,
        picksPerHour: 0,
        peakHourPicks: 0,
        hourlyPattern: {},
        normalizedScore: 0,
      };
    }

    const totalPicks = assignments.reduce(
      (sum, a) => sum + (a.avgPicksPerHour ? Number(a.avgPicksPerHour) : 0),
      0,
    );

    const hourlyPattern = await this.getHourlyPattern(skuId, locationId, lookbackDate);
    const peakHourPicks = Math.max(...Object.values(hourlyPattern), 0);
    const avgPicksPerHour = totalPicks / (lookbackDays * 24);

    const normalizedScore = this.normalize(avgPicksPerHour);

    return {
      totalPicks: Math.round(totalPicks),
      picksPerHour: avgPicksPerHour,
      peakHourPicks,
      hourlyPattern,
      normalizedScore,
    };
  }

  private async getHourlyPattern(
    skuId: string,
    locationId: string,
    since: Date,
  ): Promise<Record<number, number>> {
    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        pickLocationId: locationId,
        eventTime: { gte: since },
      },
      select: {
        eventTime: true,
      },
    });

    const hourlyBuckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyBuckets[i] = 0;
    }

    snapshots.forEach((snap) => {
      const hour = snap.eventTime.getHours();
      hourlyBuckets[hour]++;
    });

    return hourlyBuckets;
  }

  private normalize(picksPerHour: number, maxExpected = 50): number {
    return Math.min(picksPerHour / maxExpected, 1.0);
  }

  async getWarehouseMaxFrequency(warehouseId: string): Promise<number> {
    const maxAssignment = await this.prisma.assignment.findFirst({
      where: {
        pickLocation: {
          zone: {
            warehouseId,
          },
        },
        toTs: null,
      },
      orderBy: {
        avgPicksPerHour: 'desc',
      },
      select: {
        avgPicksPerHour: true,
      },
    });

    return maxAssignment?.avgPicksPerHour ? Number(maxAssignment.avgPicksPerHour) : 50;
  }
}
