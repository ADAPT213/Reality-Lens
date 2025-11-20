import { Controller, Get, Post, Param, Body, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';
import { InventoryHeatmapService } from './heatmap.service';
import { ScenarioService } from './scenario.service';
import { InventoryAlertsService } from './inventory-alerts.service';
import { SimulateScenarioDto, GetAlertsQueryDto } from './dto/inventory.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(
    private readonly heatmapService: InventoryHeatmapService,
    private readonly scenarioService: ScenarioService,
    private readonly alertsService: InventoryAlertsService,
  ) {}

  @Get('heatmap/:warehouseId')
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get warehouse rack heatmap with multiple efficiency layers' })
  @ApiResponse({
    status: 200,
    description: 'Heatmap with pick frequency, travel cost, ergonomic, and efficiency layers',
  })
  async getHeatmap(@Param('warehouseId') warehouseId: string) {
    this.logger.log(`Generating heatmap for warehouse ${warehouseId}`);
    return this.heatmapService.generateHeatmap(warehouseId);
  }

  @Post('scenario/simulate')
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Simulate what-if scenarios for inventory moves' })
  @ApiResponse({
    status: 200,
    description: 'Simulation results with impact metrics and recommendations',
  })
  async simulateScenario(
    @Query('warehouseId') warehouseId: string,
    @Body() dto: SimulateScenarioDto,
  ) {
    this.logger.log(`Simulating ${dto.moves.length} moves for warehouse ${warehouseId}`);
    return this.scenarioService.simulate(warehouseId, dto.moves);
  }

  @Get('alerts/:warehouseId')
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get real-time inventory inefficiency alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts for inventory inefficiencies' })
  async getAlerts(@Param('warehouseId') warehouseId: string, @Query() query: GetAlertsQueryDto) {
    this.logger.log(`Fetching alerts for warehouse ${warehouseId}`);
    return this.alertsService.getAlerts(warehouseId, query.limit);
  }

  @Post('alerts/:warehouseId/detect')
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Run inefficiency detection and generate new alerts' })
  @ApiResponse({ status: 200, description: 'Newly detected inefficiency alerts' })
  async detectInefficiencies(@Param('warehouseId') warehouseId: string) {
    this.logger.log(`Running inefficiency detection for warehouse ${warehouseId}`);
    return this.alertsService.detectInefficiencies(warehouseId);
  }

  @Get('underutilized/:warehouseId')
  @Roles(Role.INVENTORY_MANAGER, Role.WAREHOUSE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get prime locations with low-value SKUs' })
  @ApiResponse({
    status: 200,
    description: 'List of underutilized prime locations with opportunity costs',
  })
  async getUnderutilized(@Param('warehouseId') warehouseId: string) {
    this.logger.log(`Fetching underutilized locations for warehouse ${warehouseId}`);
    return this.alertsService.getUnderutilizedLocations(warehouseId);
  }
}
