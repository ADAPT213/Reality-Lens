import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface PlacementRecommendation {
  skuId: string;
  fromLocationId: string;
  toLocationId: string;
  reason: string;
  expectedDeltaRisk: number;
  expectedDeltaDistance: number;
}

@Injectable()
export class OptimizationService {
  constructor(private prisma: PrismaService) {}

  async generateRecommendations(warehouseId: string): Promise<PlacementRecommendation[]> {
    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: { warehouseId },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    const assignments = await this.prisma.assignment.findMany({
      where: { pickLocation: { zone: { warehouseId } }, toTs: null },
      include: { pickLocation: true, sku: true },
    });

    const impactMap = new Map<string, number>();
    for (const snap of snapshots) {
      if (!snap.pickLocationId || !snap.compositeRisk) continue;
      const picks = 100;
      const impact = Number(snap.compositeRisk) * picks;
      impactMap.set(snap.pickLocationId, (impactMap.get(snap.pickLocationId) || 0) + impact);
    }

    const sorted = [...impactMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const recommendations: PlacementRecommendation[] = [];

    for (const [locationId, _impact] of sorted) {
      const assignment = assignments.find((a: any) => a.pickLocationId === locationId);
      if (!assignment) continue;

      const betterLocations = await this.prisma.pickLocation.findMany({
        where: {
          zone: { warehouseId },
          reachBand: 'preferred',
          id: { not: locationId },
        },
        take: 5,
      });

      if (betterLocations.length > 0) {
        const target = betterLocations[0];
        recommendations.push({
          skuId: assignment.skuId,
          fromLocationId: locationId,
          toLocationId: target.id,
          reason: `Move to preferred reach band from ${assignment.pickLocation.reachBand || 'unknown'}`,
          expectedDeltaRisk: -2.5,
          expectedDeltaDistance: 0,
        });
      }
    }

    return recommendations;
  }
}
