import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClarityMetricsService } from './metrics.service';
import { GuidanceService } from './guidance.service';

@Controller('api/v1/clarity')
export class ClarityController {
  constructor(
    private readonly metrics: ClarityMetricsService,
    private readonly guidance: GuidanceService,
  ) {}

  @Get('user/:id/metrics')
  getUserMetrics(@Param('id') id: string) {
    return this.metrics.getUserMetrics(id);
  }

  @Get('replen/guidance')
  requestReplenGuidance(@Query('userId') userId: string) {
    return this.guidance.requestGuidance(userId, { area: 'replen' });
  }

  @Get('warehouse/:id/metrics')
  getWarehouseMetrics(@Param('id') id: string) {
    return this.metrics.getScopeMetrics('warehouse', id);
  }

  @Get('copilot/user/:id/metrics')
  copilotUserMetrics(@Param('id') id: string) {
    return this.metrics.getScopeMetrics('warehouse', 'WH-001');
  }

  @Get('copilot/replen-guidance')
  copilotReplenGuidance(@Query('warehouseId') warehouseId?: string) {
    return this.guidance.requestGuidance('system', {
      area: 'replen',
      warehouseId: warehouseId || 'WH-001',
    });
  }
}
