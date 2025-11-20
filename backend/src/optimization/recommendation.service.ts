import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PositioningEngineService, DetailedScore } from './positioning-engine.service';
import {
  MoveRecommendationDto,
  MoveRecommendationResponse,
  ImpactMetrics,
} from './schemas/move-recommendation.schema';

interface MoveCandidate {
  skuId: string;
  skuCode: string;
  fromLocationId: string;
  fromLocationLabel: string;
  currentScore: DetailedScore;
  candidateLocations: {
    locationId: string;
    locationLabel: string;
    score: DetailedScore;
  }[];
}

@Injectable()
export class RecommendationService {
  constructor(
    private prisma: PrismaService,
    private positioningEngine: PositioningEngineService,
  ) {}

  async generateRecommendations(
    warehouseId: string,
    options: {
      limit?: number;
      minImpact?: number;
      includeEffortEstimate?: boolean;
    } = {},
  ): Promise<MoveRecommendationResponse> {
    const { limit = 20, minImpact = 0.1, includeEffortEstimate = true } = options;

    const candidates = await this.identifyMoveCandidates(warehouseId);

    const recommendations: MoveRecommendationDto[] = [];

    for (const candidate of candidates) {
      const bestAlternative = candidate.candidateLocations.reduce((best, current) => {
        return current.score.totalScore > best.score.totalScore ? current : best;
      }, candidate.candidateLocations[0]);

      if (!bestAlternative) continue;

      const scoreImprovement = bestAlternative.score.totalScore - candidate.currentScore.totalScore;

      if (scoreImprovement < minImpact) continue;

      const impactAnalysis = await this.calculateImpact(
        candidate.skuId,
        candidate.fromLocationId,
        bestAlternative.locationId,
        scoreImprovement,
        includeEffortEstimate,
      );

      const roi = this.calculateROI(scoreImprovement, impactAnalysis);

      recommendations.push({
        id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        warehouseId,
        skuId: candidate.skuId,
        skuCode: candidate.skuCode,
        fromLocationId: candidate.fromLocationId,
        fromLocationLabel: candidate.fromLocationLabel,
        toLocationId: bestAlternative.locationId,
        toLocationLabel: bestAlternative.locationLabel,
        currentScore: candidate.currentScore.breakdown,
        proposedScore: bestAlternative.score.breakdown,
        scoreImprovement,
        impactAnalysis,
        roi,
        priority: this.determinePriority(scoreImprovement, roi),
        reasoning: this.generateReasoning(candidate, bestAlternative, impactAnalysis),
        createdAt: new Date().toISOString(),
      });
    }

    const sorted = recommendations.sort((a, b) => b.roi - a.roi).slice(0, limit);

    const summary = this.calculateSummary(sorted);

    return {
      recommendations: sorted,
      summary,
    };
  }

  private async identifyMoveCandidates(warehouseId: string): Promise<MoveCandidate[]> {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        toTs: null,
        pickLocation: {
          zone: {
            warehouseId,
          },
        },
      },
      include: {
        sku: true,
        pickLocation: true,
      },
      take: 100,
    });

    const candidates: MoveCandidate[] = [];

    for (const assignment of assignments) {
      const currentScore = await this.positioningEngine.calculateScore(
        assignment.skuId,
        assignment.pickLocationId,
        warehouseId,
      );

      if (currentScore.totalScore > 0.5) continue;

      const alternativeLocations = await this.findAlternativeLocations(
        assignment.pickLocation.zoneId,
        assignment.pickLocationId,
      );

      const candidateLocations = await Promise.all(
        alternativeLocations.map(async (loc) => ({
          locationId: loc.id,
          locationLabel: loc.label,
          score: await this.positioningEngine.calculateScore(assignment.skuId, loc.id, warehouseId),
        })),
      );

      candidates.push({
        skuId: assignment.skuId,
        skuCode: assignment.sku.skuCode,
        fromLocationId: assignment.pickLocationId,
        fromLocationLabel: assignment.pickLocation.label,
        currentScore,
        candidateLocations,
      });
    }

    return candidates;
  }

  private async findAlternativeLocations(zoneId: string, excludeLocationId: string) {
    return this.prisma.pickLocation.findMany({
      where: {
        zoneId,
        id: { not: excludeLocationId },
        assignments: {
          none: {
            toTs: null,
          },
        },
      },
      take: 5,
    });
  }

  private async calculateImpact(
    skuId: string,
    fromLocationId: string,
    toLocationId: string,
    scoreImprovement: number,
    includeEffort: boolean,
  ): Promise<ImpactMetrics> {
    const frequency = await this.prisma.assignment.findFirst({
      where: { skuId, pickLocationId: fromLocationId },
      select: { avgPicksPerHour: true },
    });

    const avgPicksPerHour = frequency?.avgPicksPerHour ? Number(frequency.avgPicksPerHour) : 10;
    const affectedOrdersPerDay = avgPicksPerHour * 8;

    const secondsPerPickSaved = scoreImprovement * 15;

    const fromErgonomic = await this.positioningEngine.calculateScore(skuId, fromLocationId, '');
    const toErgonomic = await this.positioningEngine.calculateScore(skuId, toLocationId, '');
    const riskReductionPercent =
      ((fromErgonomic.components.ergonomic.normalizedScore -
        toErgonomic.components.ergonomic.normalizedScore) /
        Math.max(fromErgonomic.components.ergonomic.normalizedScore, 0.01)) *
      100;

    let effortEstimate = {
      estimatedMinutes: 30,
    };

    if (includeEffort) {
      const sku = await this.prisma.sku.findUnique({
        where: { id: skuId },
        select: { weightKg: true, volumeCm3: true },
      });

      const weight = sku?.weightKg ? Number(sku.weightKg) : 10;
      const pallets = weight > 100 ? 1 : 0;
      const cartons = weight <= 100 ? Math.ceil(weight / 10) : 0;

      effortEstimate = {
        estimatedMinutes: pallets * 45 + cartons * 5,
      } as any;
    }

    return {
      secondsPerPickSaved,
      riskReductionPercent,
      affectedOrdersPerDay,
      effortEstimate,
    };
  }

  private calculateROI(scoreImprovement: number, impact: ImpactMetrics): number {
    const dailyTimeSavings = impact.secondsPerPickSaved * impact.affectedOrdersPerDay;
    const implementationCost = impact.effortEstimate.estimatedMinutes * 60;

    if (implementationCost === 0) return 0;

    return (dailyTimeSavings / implementationCost) * 100;
  }

  private determinePriority(
    scoreImprovement: number,
    roi: number,
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (scoreImprovement > 0.5 && roi > 200) return 'critical';
    if (scoreImprovement > 0.3 && roi > 100) return 'high';
    if (scoreImprovement > 0.15 && roi > 50) return 'medium';
    return 'low';
  }

  private generateReasoning(
    candidate: MoveCandidate,
    bestAlternative: { score: DetailedScore; locationLabel: string },
    impact: ImpactMetrics,
  ): string {
    const reasons: string[] = [];

    const currentErgo = candidate.currentScore.components.ergonomic;
    const proposedErgo = bestAlternative.score.components.ergonomic;

    if (currentErgo.band === 'red' && proposedErgo.band === 'green') {
      reasons.push('Moves from red to green ergonomic band');
    }

    if (impact.secondsPerPickSaved > 5) {
      reasons.push(`Saves ${impact.secondsPerPickSaved.toFixed(1)}s per pick`);
    }

    if (impact.riskReductionPercent > 20) {
      reasons.push(`Reduces ergonomic risk by ${impact.riskReductionPercent.toFixed(0)}%`);
    }

    if (bestAlternative.score.components.travelCost.distanceFromDock < 50) {
      reasons.push('Moves closer to dock');
    }

    return reasons.join('; ') || 'General improvement in positioning score';
  }

  private calculateSummary(recommendations: MoveRecommendationDto[]) {
    const totalSecondsPerDaySaved = recommendations.reduce(
      (sum, rec) =>
        sum + rec.impactAnalysis.secondsPerPickSaved * rec.impactAnalysis.affectedOrdersPerDay,
      0,
    );

    const totalRiskReduction =
      recommendations.reduce((sum, rec) => sum + rec.impactAnalysis.riskReductionPercent, 0) /
      recommendations.length;

    const estimatedImplementationHours = recommendations.reduce(
      (sum, rec) => sum + rec.impactAnalysis.effortEstimate.estimatedMinutes / 60,
      0,
    );

    return {
      totalRecommendations: recommendations.length,
      totalSecondsPerDaySaved: Math.round(totalSecondsPerDaySaved),
      totalRiskReduction: Math.round(totalRiskReduction),
      estimatedImplementationHours: Math.round(estimatedImplementationHours * 10) / 10,
    };
  }
}
