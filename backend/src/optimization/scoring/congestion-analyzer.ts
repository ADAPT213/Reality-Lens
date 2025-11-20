import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface CongestionMetrics {
  currentPicksPerHour: number;
  peakPicksPerHour: number;
  zoneUtilization: number;
  conflictProbability: number;
  normalizedScore: number;
}

@Injectable()
export class CongestionAnalyzer {
  constructor(private prisma: PrismaService) {}

  async analyzeCongestion(locationId: string, lookbackDays = 7): Promise<CongestionMetrics> {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { zoneId: true },
    });

    if (!location) {
      return {
        currentPicksPerHour: 0,
        peakPicksPerHour: 0,
        zoneUtilization: 0,
        conflictProbability: 0,
        normalizedScore: 0,
      };
    }

    const zoneSnapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        zoneId: location.zoneId,
        eventTime: { gte: lookbackDate },
      },
      select: {
        eventTime: true,
        pickLocationId: true,
      },
    });

    const hourlyActivity = this.groupByHour(zoneSnapshots);
    const currentPicksPerHour = this.getCurrentPicksPerHour(hourlyActivity);
    const peakPicksPerHour = Math.max(...Object.values(hourlyActivity), 0);

    const totalLocations = await this.prisma.pickLocation.count({
      where: { zoneId: location.zoneId },
    });

    const activeLocations = new Set(zoneSnapshots.map((s) => s.pickLocationId)).size;
    const zoneUtilization = totalLocations > 0 ? activeLocations / totalLocations : 0;

    const conflictProbability = this.calculateConflictProbability(
      currentPicksPerHour,
      totalLocations,
    );

    const normalizedScore = this.normalize(
      currentPicksPerHour,
      peakPicksPerHour,
      zoneUtilization,
      conflictProbability,
    );

    return {
      currentPicksPerHour,
      peakPicksPerHour,
      zoneUtilization,
      conflictProbability,
      normalizedScore,
    };
  }

  private groupByHour(snapshots: { eventTime: Date }[]): Record<string, number> {
    const hourly: Record<string, number> = {};

    snapshots.forEach((snap) => {
      const hourKey = snap.eventTime.toISOString().slice(0, 13);
      hourly[hourKey] = (hourly[hourKey] || 0) + 1;
    });

    return hourly;
  }

  private getCurrentPicksPerHour(hourlyActivity: Record<string, number>): number {
    const currentHour = new Date().toISOString().slice(0, 13);
    return hourlyActivity[currentHour] || 0;
  }

  private calculateConflictProbability(picksPerHour: number, totalLocations: number): number {
    if (totalLocations === 0) return 0;
    const density = picksPerHour / totalLocations;
    return Math.min(density / 5, 1.0);
  }

  private normalize(current: number, peak: number, utilization: number, conflict: number): number {
    const currentComponent = Math.min(current / 100, 1.0) * 0.3;
    const peakComponent = Math.min(peak / 150, 1.0) * 0.2;
    const utilizationComponent = utilization * 0.3;
    const conflictComponent = conflict * 0.2;

    return currentComponent + peakComponent + utilizationComponent + conflictComponent;
  }

  async getZoneCongestionLevel(zoneId: string): Promise<'low' | 'medium' | 'high'> {
    const locations = await this.prisma.pickLocation.findMany({
      where: { zoneId },
      select: { id: true },
    });

    if (locations.length === 0) return 'low';

    const congestionMetrics = await Promise.all(
      locations.map((loc) => this.analyzeCongestion(loc.id)),
    );

    const avgUtilization =
      congestionMetrics.reduce((sum, m) => sum + m.zoneUtilization, 0) / congestionMetrics.length;

    if (avgUtilization > 0.7) return 'high';
    if (avgUtilization > 0.4) return 'medium';
    return 'low';
  }
}
