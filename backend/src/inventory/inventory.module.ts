import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryHeatmapService } from './heatmap.service';
import { ScenarioService } from './scenario.service';
import { InventoryAlertsService } from './inventory-alerts.service';
import { InventorySchedulerService } from './inventory-scheduler.service';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryHeatmapService,
    ScenarioService,
    InventoryAlertsService,
    InventorySchedulerService,
  ],
  exports: [InventoryHeatmapService, ScenarioService, InventoryAlertsService],
})
export class InventoryModule {}
