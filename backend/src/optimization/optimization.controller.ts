import { Controller, Get, Param, Query, UseGuards, Post, Body } from '@nestjs/common';
import { OptimizationService } from './optimization.service';
import { PositioningEngineService } from './positioning-engine.service';
import { RecommendationService } from './recommendation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('optimization')
@UseGuards(JwtAuthGuard)
export class OptimizationController {
  constructor(
    private readonly optimizationService: OptimizationService,
    private readonly positioningEngine: PositioningEngineService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get('warehouses/:warehouseId/recommendations')
  async getRecommendations(
    @Param('warehouseId') warehouseId: string,
    @Query('limit') limit?: string,
    @Query('minImpact') minImpact?: string,
  ) {
    return this.recommendationService.generateRecommendations(warehouseId, {
      limit: limit ? parseInt(limit, 10) : 20,
      minImpact: minImpact ? parseFloat(minImpact) : 0.1,
      includeEffortEstimate: true,
    });
  }

  @Get('warehouses/:warehouseId/score')
  async calculateScore(
    @Param('warehouseId') warehouseId: string,
    @Query('skuId') skuId: string,
    @Query('locationId') locationId: string,
  ) {
    if (!skuId || !locationId) {
      return { error: 'skuId and locationId are required' };
    }
    return this.positioningEngine.calculateScore(skuId, locationId, warehouseId);
  }

  @Get('warehouses/:warehouseId/explain')
  async explainScore(
    @Param('warehouseId') warehouseId: string,
    @Query('skuId') skuId: string,
    @Query('locationId') locationId: string,
  ) {
    if (!skuId || !locationId) {
      return { error: 'skuId and locationId are required' };
    }
    return this.positioningEngine.explainScore(skuId, locationId, warehouseId);
  }

  @Get('warehouses/:warehouseId/compare')
  async compareLocations(
    @Param('warehouseId') warehouseId: string,
    @Query('skuId') skuId: string,
    @Query('locationIds') locationIds: string,
  ) {
    if (!skuId || !locationIds) {
      return { error: 'skuId and locationIds are required' };
    }
    const locationIdArray = locationIds.split(',');
    const scores = await this.positioningEngine.compareLocations(
      skuId,
      locationIdArray,
      warehouseId,
    );
    return Object.fromEntries(scores);
  }

  @Post('warehouses/:warehouseId/find-best')
  async findBestLocation(
    @Param('warehouseId') warehouseId: string,
    @Body() body: { skuId: string; candidateLocationIds: string[] },
  ) {
    return this.positioningEngine.findBestLocation(
      body.skuId,
      body.candidateLocationIds,
      warehouseId,
    );
  }

  @Get('warehouses/:warehouseId/weights')
  async getWeights(@Param('warehouseId') warehouseId: string) {
    return this.positioningEngine.getWarehouseWeights(warehouseId);
  }

  @Get('recommendations/:warehouseId')
  async getLegacyRecommendations(@Param('warehouseId') warehouseId: string) {
    const recs = await this.optimizationService.generateRecommendations(warehouseId);
    return { recommendations: recs };
  }
}
