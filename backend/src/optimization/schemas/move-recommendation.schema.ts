import { IsString, IsNumber, IsObject, IsOptional } from 'class-validator';

export interface ScoreBreakdown {
  frequencyScore: number;
  travelCostScore: number;
  ergonomicScore: number;
  congestionScore: number;
  ruleAlignmentScore: number;
  totalScore: number;
  weights: {
    frequency: number;
    travelCost: number;
    ergonomic: number;
    congestion: number;
  };
}

export interface ImpactMetrics {
  secondsPerPickSaved: number;
  riskReductionPercent: number;
  affectedOrdersPerDay: number;
  effortEstimate: {
    pallets?: number;
    cartons?: number;
    estimatedMinutes: number;
  };
}

export class MoveRecommendationDto {
  @IsString()
  id: string;

  @IsString()
  warehouseId: string;

  @IsString()
  skuId: string;

  @IsString()
  skuCode: string;

  @IsString()
  fromLocationId: string;

  @IsString()
  fromLocationLabel: string;

  @IsString()
  toLocationId: string;

  @IsString()
  toLocationLabel: string;

  @IsObject()
  currentScore: ScoreBreakdown;

  @IsObject()
  proposedScore: ScoreBreakdown;

  @IsNumber()
  scoreImprovement: number;

  @IsObject()
  impactAnalysis: ImpactMetrics;

  @IsNumber()
  roi: number;

  @IsString()
  priority: 'critical' | 'high' | 'medium' | 'low';

  @IsOptional()
  @IsString()
  reasoning?: string;

  @IsString()
  createdAt: string;
}

export class MoveRecommendationResponse {
  recommendations: MoveRecommendationDto[];
  summary: {
    totalRecommendations: number;
    totalSecondsPerDaySaved: number;
    totalRiskReduction: number;
    estimatedImplementationHours: number;
  };
}
