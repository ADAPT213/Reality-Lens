import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface ProposedMove {
  skuCode: string;
  fromLocationId: string;
  toLocationId: string;
}

interface ScenarioSimulation {
  proposedMoves: ProposedMove[];
  metrics: {
    walkingDistanceSaved: number;
    picksPerHourChange: number;
    ergonomicRiskDelta: number;
  };
  affectedClientLanes: Array<{
    clientId: string;
    laneId: string;
    slaImpact: number;
  }>;
  recommendations: string[];
}

@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);
  private readonly LOOKBACK_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  async simulate(warehouseId: string, moves: ProposedMove[]): Promise<ScenarioSimulation> {
    const since = new Date(Date.now() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const locationIds = [
      ...new Set([...moves.map((m) => m.fromLocationId), ...moves.map((m) => m.toLocationId)]),
    ];

    const locations = await this.prisma.pickLocation.findMany({
      where: {
        id: { in: locationIds },
        zone: { warehouseId },
      },
      select: {
        id: true,
        label: true,
        xCoord: true,
        yCoord: true,
        zHeightCm: true,
        reachBand: true,
        assignments: {
          where: {
            OR: [{ toTs: null }, { toTs: { gte: since } }],
          },
          orderBy: { fromTs: 'desc' },
          take: 1,
          select: {
            avgPicksPerHour: true,
            sku: {
              select: {
                skuCode: true,
              },
            },
          },
        },
        ergonomicSnapshots: {
          where: {
            timestamp: { gte: since },
          },
          select: {
            compositeRisk: true,
          },
        },
      },
    });

    const locationMap = new Map(locations.map((l) => [l.id, l]));

    let totalDistanceSaved = 0;
    let totalPickRateChange = 0;
    let totalErgoDelta = 0;

    for (const move of moves) {
      const fromLoc = locationMap.get(move.fromLocationId);
      const toLoc = locationMap.get(move.toLocationId);

      if (!fromLoc || !toLoc) continue;

      const pickFrequency = fromLoc.assignments[0]?.avgPicksPerHour
        ? Number(fromLoc.assignments[0].avgPicksPerHour)
        : 0;

      const fromDistance = this.estimateTravelDistance(fromLoc);
      const toDistance = this.estimateTravelDistance(toLoc);
      const distanceSavedPerPick = fromDistance - toDistance;
      totalDistanceSaved += distanceSavedPerPick * pickFrequency;

      const fromErgoRisk = this.getAvgRisk(fromLoc.ergonomicSnapshots);
      const toErgoRisk = this.getAvgRisk(toLoc.ergonomicSnapshots);
      totalErgoDelta += (fromErgoRisk - toErgoRisk) * pickFrequency;

      const pickRateMultiplier = this.calculatePickRateMultiplier(fromLoc, toLoc);
      totalPickRateChange += pickFrequency * (pickRateMultiplier - 1);
    }

    const affectedClientLanes = await this.findAffectedClientLanes(warehouseId, moves);

    const recommendations = this.generateRecommendations({
      walkingDistanceSaved: totalDistanceSaved,
      picksPerHourChange: totalPickRateChange,
      ergonomicRiskDelta: totalErgoDelta,
    });

    return {
      proposedMoves: moves,
      metrics: {
        walkingDistanceSaved: Math.round(totalDistanceSaved),
        picksPerHourChange: Math.round(totalPickRateChange * 10) / 10,
        ergonomicRiskDelta: Math.round(totalErgoDelta * 100) / 100,
      },
      affectedClientLanes,
      recommendations,
    };
  }

  private estimateTravelDistance(location: any): number {
    const x = Number(location.xCoord || 0);
    const y = Number(location.yCoord || 0);
    return Math.sqrt(x * x + y * y);
  }

  private getAvgRisk(snapshots: Array<{ compositeRisk: any }>): number {
    if (snapshots.length === 0) return 5.0;
    return snapshots.reduce((sum, s) => sum + Number(s.compositeRisk), 0) / snapshots.length;
  }

  private calculatePickRateMultiplier(fromLoc: any, toLoc: any): number {
    const fromHeight = Number(fromLoc.zHeightCm || 100);
    const toHeight = Number(toLoc.zHeightCm || 100);

    const optimalHeight = 120;
    const fromHeightPenalty = Math.abs(fromHeight - optimalHeight) / optimalHeight;
    const toHeightPenalty = Math.abs(toHeight - optimalHeight) / optimalHeight;

    const fromRate = 1 - fromHeightPenalty * 0.3;
    const toRate = 1 - toHeightPenalty * 0.3;

    return toRate / fromRate;
  }

  private async findAffectedClientLanes(
    warehouseId: string,
    moves: ProposedMove[],
  ): Promise<Array<{ clientId: string; laneId: string; slaImpact: number }>> {
    return [];
  }

  private generateRecommendations(metrics: {
    walkingDistanceSaved: number;
    picksPerHourChange: number;
    ergonomicRiskDelta: number;
  }): string[] {
    const recs: string[] = [];

    if (metrics.walkingDistanceSaved > 500) {
      recs.push('Significant travel savings - high priority implementation');
    } else if (metrics.walkingDistanceSaved < 0) {
      recs.push('Warning: This move increases walking distance');
    }

    if (metrics.ergonomicRiskDelta > 1.0) {
      recs.push('Warning: Increased ergonomic risk - review before proceeding');
    } else if (metrics.ergonomicRiskDelta < -1.0) {
      recs.push('Excellent: Reduces worker injury risk');
    }

    if (metrics.picksPerHourChange > 5) {
      recs.push('Productivity gain expected');
    } else if (metrics.picksPerHourChange < -5) {
      recs.push('Warning: May reduce picking productivity');
    }

    if (recs.length === 0) {
      recs.push('Neutral impact - implement based on strategic goals');
    }

    return recs;
  }
}
