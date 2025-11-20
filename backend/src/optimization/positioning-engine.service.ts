import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FrequencyCalculator, FrequencyMetrics } from './scoring/frequency-calculator';
import { TravelCostCalculator, TravelCostMetrics } from './scoring/travel-cost-calculator';
import { ErgonomicScorer, ErgonomicMetrics } from './scoring/ergonomic-scorer';
import { CongestionAnalyzer, CongestionMetrics } from './scoring/congestion-analyzer';
import { RuleEngine, RuleAlignmentMetrics } from './scoring/rule-engine';
import { ScoreBreakdown } from './schemas/move-recommendation.schema';

export interface ScoringWeights {
  frequency: number;
  travelCost: number;
  ergonomic: number;
  congestion: number;
}

export interface DetailedScore {
  totalScore: number;
  breakdown: ScoreBreakdown;
  components: {
    frequency: FrequencyMetrics;
    travelCost: TravelCostMetrics;
    ergonomic: ErgonomicMetrics;
    congestion: CongestionMetrics;
    ruleAlignment: RuleAlignmentMetrics;
  };
}

@Injectable()
export class PositioningEngineService {
  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    frequency: 0.4,
    travelCost: 0.3,
    ergonomic: 0.2,
    congestion: 0.1,
  };

  constructor(
    private prisma: PrismaService,
    private frequencyCalc: FrequencyCalculator,
    private travelCostCalc: TravelCostCalculator,
    private ergonomicScorer: ErgonomicScorer,
    private congestionAnalyzer: CongestionAnalyzer,
    private ruleEngine: RuleEngine,
  ) {}

  async calculateScore(
    skuId: string,
    locationId: string,
    warehouseId: string,
    customWeights?: Partial<ScoringWeights>,
  ): Promise<DetailedScore> {
    const weights = { ...this.DEFAULT_WEIGHTS, ...customWeights };

    const [frequency, travelCost, ergonomic, congestion, ruleAlignment] = await Promise.all([
      this.frequencyCalc.calculateFrequency(skuId, locationId),
      this.travelCostCalc.calculateTravelCost(locationId, warehouseId),
      this.ergonomicScorer.calculateErgonomicScore(locationId),
      this.congestionAnalyzer.analyzeCongestion(locationId),
      this.ruleEngine.calculateRuleAlignment(skuId, locationId, warehouseId),
    ]);

    const totalScore = this.computeTotalScore(
      frequency,
      travelCost,
      ergonomic,
      congestion,
      ruleAlignment,
      weights,
    );

    const breakdown: ScoreBreakdown = {
      frequencyScore: frequency.normalizedScore,
      travelCostScore: travelCost.normalizedScore,
      ergonomicScore: ergonomic.normalizedScore,
      congestionScore: congestion.normalizedScore,
      ruleAlignmentScore: ruleAlignment.totalBonus,
      totalScore,
      weights,
    };

    return {
      totalScore,
      breakdown,
      components: {
        frequency,
        travelCost,
        ergonomic,
        congestion,
        ruleAlignment,
      },
    };
  }

  private computeTotalScore(
    frequency: FrequencyMetrics,
    travelCost: TravelCostMetrics,
    ergonomic: ErgonomicMetrics,
    congestion: CongestionMetrics,
    ruleAlignment: RuleAlignmentMetrics,
    weights: ScoringWeights,
  ): number {
    const score =
      weights.frequency * frequency.normalizedScore -
      weights.travelCost * travelCost.normalizedScore -
      weights.ergonomic * ergonomic.normalizedScore -
      weights.congestion * congestion.normalizedScore +
      ruleAlignment.totalBonus;

    return Math.max(-1, Math.min(1, score));
  }

  async getWarehouseWeights(warehouseId: string): Promise<ScoringWeights> {
    return this.DEFAULT_WEIGHTS;
  }

  async updateWarehouseWeights(
    warehouseId: string,
    weights: Partial<ScoringWeights>,
  ): Promise<ScoringWeights> {
    return { ...this.DEFAULT_WEIGHTS, ...weights };
  }

  async compareLocations(
    skuId: string,
    locationIds: string[],
    warehouseId: string,
  ): Promise<Map<string, DetailedScore>> {
    const scores = new Map<string, DetailedScore>();

    await Promise.all(
      locationIds.map(async (locationId) => {
        const score = await this.calculateScore(skuId, locationId, warehouseId);
        scores.set(locationId, score);
      }),
    );

    return scores;
  }

  async findBestLocation(
    skuId: string,
    candidateLocationIds: string[],
    warehouseId: string,
  ): Promise<{ locationId: string; score: DetailedScore } | null> {
    const scores = await this.compareLocations(skuId, candidateLocationIds, warehouseId);

    let bestLocation: string | null = null;
    let bestScore: DetailedScore | null = null;

    for (const [locationId, score] of scores.entries()) {
      if (!bestScore || score.totalScore > bestScore.totalScore) {
        bestLocation = locationId;
        bestScore = score;
      }
    }

    if (!bestLocation || !bestScore) return null;

    return {
      locationId: bestLocation,
      score: bestScore,
    };
  }

  async explainScore(
    skuId: string,
    locationId: string,
    warehouseId: string,
  ): Promise<{
    score: DetailedScore;
    explanation: string[];
  }> {
    const score = await this.calculateScore(skuId, locationId, warehouseId);
    const explanation: string[] = [];

    explanation.push(
      `Total Score: ${score.totalScore.toFixed(3)} (range: -1.0 to 1.0, higher is better)`,
    );
    explanation.push('');
    explanation.push('Score Breakdown:');
    explanation.push(
      `  Frequency (${score.breakdown.weights.frequency * 100}%): ${score.breakdown.frequencyScore.toFixed(3)} - ${score.components.frequency.picksPerHour.toFixed(1)} picks/hour`,
    );
    explanation.push(
      `  Travel Cost (${score.breakdown.weights.travelCost * 100}%): -${score.breakdown.travelCostScore.toFixed(3)} - ${score.components.travelCost.distanceFromDock.toFixed(1)}m from dock`,
    );
    explanation.push(
      `  Ergonomic (${score.breakdown.weights.ergonomic * 100}%): -${score.breakdown.ergonomicScore.toFixed(3)} - ${score.components.ergonomic.band} band (risk: ${score.components.ergonomic.averageCompositeRisk.toFixed(2)})`,
    );
    explanation.push(
      `  Congestion (${score.breakdown.weights.congestion * 100}%): -${score.breakdown.congestionScore.toFixed(3)} - ${(score.components.congestion.zoneUtilization * 100).toFixed(1)}% zone utilization`,
    );
    explanation.push(
      `  Rule Alignment Bonus: +${score.breakdown.ruleAlignmentScore.toFixed(3)} - Applied rules: ${score.components.ruleAlignment.appliedRules.join(', ') || 'none'}`,
    );

    return { score, explanation };
  }
}
