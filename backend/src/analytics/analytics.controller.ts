import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PredictiveService } from './predictive.service';
import { BaselineService } from './baseline.service';
import { HeatmapService } from './heatmap.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly predictive: PredictiveService,
    private readonly baseline: BaselineService,
    private readonly heatmap: HeatmapService,
  ) {}

  @Get('predictions/:warehouseId')
  @ApiOperation({ summary: 'Get risk predictions for warehouse' })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'horizon', required: false, type: Number })
  async getPredictions(
    @Param('warehouseId') warehouseId: string,
    @Query('zoneId') zoneId?: string,
    @Query('horizon') horizon?: string,
  ) {
    const horizonMinutes = horizon ? parseInt(horizon) : 10;
    const forecasts = await this.predictive.forecastRisk(warehouseId, horizonMinutes, zoneId);

    return {
      warehouseId,
      zoneId,
      horizonMinutes,
      forecasts,
      generatedAt: new Date(),
    };
  }

  @Get('forecast/:zoneId')
  @ApiOperation({ summary: 'Get next 10 minutes forecast for zone' })
  async getForecast(@Param('zoneId') zoneId: string) {
    const zone = await this.getZoneWithWarehouse(zoneId);
    const forecasts = await this.predictive.forecastRisk(zone.warehouseId, 10, zoneId);

    const thresholdCrossing = await this.predictive.predictThresholdCrossing(
      zone.warehouseId,
      0.8,
      zoneId,
    );

    return {
      zoneId,
      warehouseId: zone.warehouseId,
      forecasts,
      thresholdCrossing,
      generatedAt: new Date(),
    };
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Get current active anomalies' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiQuery({ name: 'zoneId', required: false })
  async getAnomalies(@Query('warehouseId') warehouseId: string, @Query('zoneId') zoneId?: string) {
    const anomaly = await this.predictive.detectAnomalies(warehouseId, zoneId);

    const baseline = await this.baseline.getBaseline(warehouseId, zoneId);
    const current = await this.predictive.calculateEWMA(warehouseId, undefined, zoneId);

    return {
      warehouseId,
      zoneId,
      current,
      anomaly,
      baseline,
      detectedAt: new Date(),
    };
  }

  @Get('baseline/:warehouseId')
  @ApiOperation({ summary: 'Get baseline statistics' })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'shiftCode', required: false })
  async getBaseline(
    @Param('warehouseId') warehouseId: string,
    @Query('zoneId') zoneId?: string,
    @Query('shiftCode') shiftCode?: string,
  ) {
    const baseline = await this.baseline.getBaseline(warehouseId, zoneId, shiftCode);

    return baseline;
  }

  @Get('heatmap/:warehouseId')
  @ApiOperation({ summary: 'Get spatial heatmap of risk hotspots' })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'gridSize', required: false, type: Number })
  async getHeatmap(
    @Param('warehouseId') warehouseId: string,
    @Query('zoneId') zoneId?: string,
    @Query('gridSize') gridSize?: string,
  ) {
    const grid = gridSize ? parseInt(gridSize) : undefined;
    const heatmap = await this.heatmap.generateHeatmap(warehouseId, grid, zoneId);
    const hotspots = await this.heatmap.identifyHotspots(warehouseId, zoneId);

    return {
      heatmap,
      hotspots,
    };
  }

  @Get('hotspots/:warehouseId')
  @ApiOperation({ summary: 'Get identified hotspot zones' })
  @ApiQuery({ name: 'zoneId', required: false })
  async getHotspots(@Param('warehouseId') warehouseId: string, @Query('zoneId') zoneId?: string) {
    const hotspots = await this.heatmap.identifyHotspots(warehouseId, zoneId);

    return {
      warehouseId,
      zoneId,
      hotspots,
      generatedAt: new Date(),
    };
  }

  private async getZoneWithWarehouse(zoneId: string) {
    return { warehouseId: 'placeholder' };
  }
}
