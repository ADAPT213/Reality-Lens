import { Module } from '@nestjs/common';
import { OptimizationService } from './optimization.service';
import { OptimizationController } from './optimization.controller';
import { CommonModule } from '../common/common.module';
import { PositioningEngineService } from './positioning-engine.service';
import { RecommendationService } from './recommendation.service';
import { FrequencyCalculator } from './scoring/frequency-calculator';
import { TravelCostCalculator } from './scoring/travel-cost-calculator';
import { ErgonomicScorer } from './scoring/ergonomic-scorer';
import { CongestionAnalyzer } from './scoring/congestion-analyzer';
import { RuleEngine } from './scoring/rule-engine';

@Module({
  imports: [CommonModule],
  controllers: [OptimizationController],
  providers: [
    OptimizationService,
    PositioningEngineService,
    RecommendationService,
    FrequencyCalculator,
    TravelCostCalculator,
    ErgonomicScorer,
    CongestionAnalyzer,
    RuleEngine,
  ],
  exports: [OptimizationService, PositioningEngineService, RecommendationService],
})
export class OptimizationModule {}
