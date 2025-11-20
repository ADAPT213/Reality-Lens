import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PositioningEngineService } from '../optimization/positioning-engine.service';
import { MovePlanType, MoveStatus } from '@prisma/client';

interface CompleteMoveData {
  actualTravelTimeSaved?: number;
  actualPickTimeSaved?: number;
  actualErgonomicImprovement?: number;
  notes?: string;
}

interface ImpactSummary {
  totalMovesCompleted: number;
  avgPredictedSecondsSaved: number;
  avgActualSecondsSaved: number;
  predictionAccuracy: {
    mae: number;
    rmse: number;
    percentageError: number;
  };
  totalErgonomicRiskReduced: number;
  roiDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  last30Days: Date;
}

@Injectable()
export class MovePlannerService {
  private readonly logger = new Logger(MovePlannerService.name);

  constructor(
    private prisma: PrismaService,
    private positioningEngine: PositioningEngineService,
  ) {}

  async generateNightlyPlan(warehouseId: string) {
    this.logger.log(`Generating nightly move plan for warehouse ${warehouseId}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const orderStats = await this.prisma.$queryRaw<
      Array<{
        sku_id: string;
        sku_code: string;
        location_id: string;
        total_picks: bigint;
        avg_pick_time: number;
        avg_travel_distance: number;
      }>
    >`
      SELECT 
        sku_id,
        sku_code,
        location_id,
        COUNT(*) as total_picks,
        AVG(pick_time) as avg_pick_time,
        AVG(travel_distance) as avg_travel_distance
      FROM order_history
      WHERE warehouse_id = ${warehouseId}
        AND order_date >= ${cutoffDate}
      GROUP BY sku_id, sku_code, location_id
      HAVING COUNT(*) >= 10
      ORDER BY total_picks DESC
      LIMIT 100
    `;

    const moveRecommendations = [];

    for (const stat of orderStats) {
      const skuId = stat.sku_id;
      const currentLocationId = stat.location_id;
      const currentFrequency = Number(stat.total_picks);

      const currentScore = await this.positioningEngine.calculateScore(
        skuId,
        currentLocationId,
        warehouseId,
      );

      const betterLocations = await this.findBetterLocations(skuId, warehouseId, currentLocationId);

      if (betterLocations.length > 0) {
        const bestLocation = betterLocations[0];
        const proposedScore = await this.positioningEngine.calculateScore(
          skuId,
          bestLocation.id,
          warehouseId,
        );

        const scoreImprovement = proposedScore.totalScore - currentScore.totalScore;

        if (scoreImprovement > 5) {
          const effortMinutes = this.estimateEffort(currentLocationId, bestLocation.id);
          const expectedGain = this.calculateExpectedGain(
            currentScore,
            proposedScore,
            currentFrequency,
            Number(stat.avg_pick_time),
            Number(stat.avg_travel_distance),
          );

          const roi = expectedGain.totalSecondsSaved / (effortMinutes * 60);

          const reasoning = this.generateReasoning(
            stat.sku_code,
            currentScore,
            proposedScore,
            currentFrequency,
            expectedGain,
          );

          moveRecommendations.push({
            skuId,
            skuCode: stat.sku_code,
            fromLocationId: currentLocationId,
            fromLocationLabel: await this.getLocationLabel(currentLocationId),
            toLocationId: bestLocation.id,
            toLocationLabel: bestLocation.label,
            effortMinutes,
            expectedGain,
            roi,
            reasoning,
            scoreImprovement,
          });
        }
      }
    }

    moveRecommendations.sort((a, b) => b.roi - a.roi);

    const movePlans = [];
    for (let i = 0; i < moveRecommendations.length; i++) {
      const rec = moveRecommendations[i];
      const movePlan = await this.prisma.movePlan.create({
        data: {
          warehouseId,
          planType: MovePlanType.NIGHTLY,
          priorityRank: i + 1,
          skuId: rec.skuId,
          skuCode: rec.skuCode,
          fromLocationId: rec.fromLocationId,
          fromLocationLabel: rec.fromLocationLabel,
          toLocationId: rec.toLocationId,
          toLocationLabel: rec.toLocationLabel,
          quantity: { unit: 'pallets', value: 1 },
          effortMinutes: rec.effortMinutes,
          expectedGain: rec.expectedGain,
          reasoning: rec.reasoning,
          status: MoveStatus.PENDING,
        },
      });
      movePlans.push(movePlan);
    }

    this.logger.log(`Generated ${movePlans.length} nightly move recommendations`);
    return movePlans;
  }

  async getLiveSuggestions(warehouseId: string) {
    const unresolvedAlerts = await this.prisma.spikeAlert.findMany({
      where: {
        warehouseId,
        resolvedAt: null,
      },
      orderBy: {
        spikeMultiplier: 'desc',
      },
      take: 10,
    });

    const suggestions = [];

    for (const alert of unresolvedAlerts) {
      const betterLocations = await this.findBetterLocations(
        alert.skuId,
        warehouseId,
        alert.currentLocationId,
      );

      if (betterLocations.length > 0) {
        const bestLocation = betterLocations[0];

        const currentScore = await this.positioningEngine.calculateScore(
          alert.skuId,
          alert.currentLocationId,
          warehouseId,
        );

        const proposedScore = await this.positioningEngine.calculateScore(
          alert.skuId,
          bestLocation.id,
          warehouseId,
        );

        const effortMinutes = this.estimateEffort(alert.currentLocationId, bestLocation.id);
        const expectedGain = this.calculateExpectedGain(
          currentScore,
          proposedScore,
          Number(alert.currentFrequency),
          5.0,
          50.0,
        );

        const roi = expectedGain.totalSecondsSaved / (effortMinutes * 60);

        const reasoning = `SPIKE ALERT: SKU ${alert.skuCode} spiked ${Number(alert.spikeMultiplier).toFixed(1)}x (${alert.currentFrequency} picks/hour vs ${alert.baselineFrequency} baseline). Moving to ${bestLocation.label} saves ${expectedGain.totalSecondsSaved.toFixed(0)} seconds/day.`;

        let existingPlan = await this.prisma.movePlan.findFirst({
          where: {
            skuId: alert.skuId,
            warehouseId,
            status: MoveStatus.PENDING,
            planType: MovePlanType.IN_SHIFT_SPIKE,
          },
        });

        if (!existingPlan) {
          existingPlan = await this.prisma.movePlan.create({
            data: {
              warehouseId,
              planType: MovePlanType.IN_SHIFT_SPIKE,
              priorityRank: 1,
              skuId: alert.skuId,
              skuCode: alert.skuCode,
              fromLocationId: alert.currentLocationId,
              fromLocationLabel: await this.getLocationLabel(alert.currentLocationId),
              toLocationId: bestLocation.id,
              toLocationLabel: bestLocation.label,
              quantity: { unit: 'pallets', value: 1 },
              effortMinutes,
              expectedGain,
              reasoning,
              status: MoveStatus.PENDING,
            },
          });

          await this.prisma.spikeAlert.update({
            where: { id: alert.id },
            data: { suggestedMoveId: existingPlan.id },
          });
        }

        suggestions.push({
          alert,
          move: existingPlan,
          roi,
        });
      }
    }

    return suggestions;
  }

  async completeMoveById(moveId: string, userId: string, data: CompleteMoveData) {
    const move = await this.prisma.movePlan.findUnique({
      where: { id: moveId },
    });

    if (!move) {
      throw new NotFoundException(`Move plan ${moveId} not found`);
    }

    const actualImpact = {
      travelTimeSaved: data.actualTravelTimeSaved || 0,
      pickTimeSaved: data.actualPickTimeSaved || 0,
      ergonomicImprovement: data.actualErgonomicImprovement || 0,
      notes: data.notes || '',
    };

    const updated = await this.prisma.movePlan.update({
      where: { id: moveId },
      data: {
        status: MoveStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: userId,
        actualImpact,
        notes: data.notes,
      },
    });

    this.logger.log(`Move ${moveId} completed by user ${userId}`);

    if (move.planType === MovePlanType.IN_SHIFT_SPIKE) {
      const spikeAlert = await this.prisma.spikeAlert.findFirst({
        where: { suggestedMoveId: moveId },
      });

      if (spikeAlert && !spikeAlert.resolvedAt) {
        await this.prisma.spikeAlert.update({
          where: { id: spikeAlert.id },
          data: { resolvedAt: new Date() },
        });
      }
    }

    return updated;
  }

  async getImpactSummary(warehouseId: string): Promise<ImpactSummary> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const completedMoves = await this.prisma.movePlan.findMany({
      where: {
        warehouseId,
        status: MoveStatus.COMPLETED,
        completedAt: {
          gte: cutoffDate,
        },
      },
    });

    if (completedMoves.length === 0) {
      return {
        totalMovesCompleted: 0,
        avgPredictedSecondsSaved: 0,
        avgActualSecondsSaved: 0,
        predictionAccuracy: { mae: 0, rmse: 0, percentageError: 0 },
        totalErgonomicRiskReduced: 0,
        roiDistribution: { high: 0, medium: 0, low: 0 },
        last30Days: cutoffDate,
      };
    }

    let totalPredicted = 0;
    let totalActual = 0;
    let totalErgonomicReduction = 0;
    let sumSquaredErrors = 0;
    let sumAbsoluteErrors = 0;

    const roiDist = { high: 0, medium: 0, low: 0 };

    for (const move of completedMoves) {
      const expectedGain = move.expectedGain as any;
      const actualImpact = move.actualImpact as any;

      const predicted = expectedGain?.totalSecondsSaved || 0;
      const actual = actualImpact?.travelTimeSaved + actualImpact?.pickTimeSaved || predicted * 0.8;

      totalPredicted += predicted;
      totalActual += actual;

      const error = predicted - actual;
      sumAbsoluteErrors += Math.abs(error);
      sumSquaredErrors += error * error;

      totalErgonomicReduction += actualImpact?.ergonomicImprovement || 0;

      const roi = predicted / (move.effortMinutes * 60);
      if (roi > 2.0) roiDist.high++;
      else if (roi > 1.0) roiDist.medium++;
      else roiDist.low++;
    }

    const count = completedMoves.length;
    const mae = sumAbsoluteErrors / count;
    const rmse = Math.sqrt(sumSquaredErrors / count);
    const percentageError = totalPredicted > 0 ? (mae / (totalPredicted / count)) * 100 : 0;

    return {
      totalMovesCompleted: count,
      avgPredictedSecondsSaved: totalPredicted / count,
      avgActualSecondsSaved: totalActual / count,
      predictionAccuracy: {
        mae,
        rmse,
        percentageError,
      },
      totalErgonomicRiskReduced: totalErgonomicReduction,
      roiDistribution: roiDist,
      last30Days: cutoffDate,
    };
  }

  private async findBetterLocations(skuId: string, warehouseId: string, currentLocationId: string) {
    const locations = await this.prisma.$queryRaw<
      Array<{ id: string; label: string; ergonomic_band: string; distance_from_dock: number }>
    >`
      SELECT pl.id, pl.label, lp.ergonomic_band, lp.distance_from_dock
      FROM pick_locations pl
      JOIN zones z ON z.id = pl.zone_id
      JOIN location_properties lp ON lp.location_id = pl.id
      WHERE z.warehouse_id = ${warehouseId}
        AND pl.id != ${currentLocationId}
        AND lp.ergonomic_band IN ('green', 'yellow')
      ORDER BY lp.distance_from_dock ASC, lp.ergonomic_band ASC
      LIMIT 5
    `;

    return locations;
  }

  private estimateEffort(fromLocationId: string, toLocationId: string): number {
    return 15 + Math.floor(Math.random() * 10);
  }

  private calculateExpectedGain(
    currentScore: any,
    proposedScore: any,
    frequency: number,
    avgPickTime: number,
    avgTravelDistance: number,
  ) {
    const travelImprovement =
      proposedScore.components.travelCost.normalizedScore -
      currentScore.components.travelCost.normalizedScore;

    const ergonomicImprovement =
      proposedScore.components.ergonomic.normalizedScore -
      currentScore.components.ergonomic.normalizedScore;

    const travelTimeSavedPerPick = (travelImprovement / 100) * 3.0;
    const pickTimeSavedPerPick = (ergonomicImprovement / 100) * 1.5;

    const totalSecondsSaved = (travelTimeSavedPerPick + pickTimeSavedPerPick) * frequency;

    return {
      travelTimeSavedPerPick,
      pickTimeSavedPerPick,
      totalSecondsSaved,
      travelImprovementScore: travelImprovement,
      ergonomicImprovementScore: ergonomicImprovement,
    };
  }

  private generateReasoning(
    skuCode: string,
    currentScore: any,
    proposedScore: any,
    frequency: number,
    expectedGain: any,
  ): string {
    const currentBand = currentScore.components.ergonomic.ergonomicBand || 'unknown';
    const proposedBand = proposedScore.components.ergonomic.ergonomicBand || 'unknown';

    const travelImprovement = expectedGain.travelImprovementScore.toFixed(1);
    const ergonomicImprovement = expectedGain.ergonomicImprovementScore.toFixed(1);

    return `SKU ${skuCode} has ${frequency} picks/week. Moving improves travel score by ${travelImprovement}% and ergonomic score by ${ergonomicImprovement}%. Ergonomic band changes from ${currentBand} to ${proposedBand}. Total expected savings: ${expectedGain.totalSecondsSaved.toFixed(0)} seconds/week.`;
  }

  private async getLocationLabel(locationId: string): Promise<string> {
    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { label: true },
    });
    return location?.label || locationId;
  }
}
