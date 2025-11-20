import { Module } from '@nestjs/common';
import { WarehouseSimulatorService } from './warehouse-simulator.service';
import { AutomationSlottingController, AutomationStatusController } from './automation.controller';

@Module({
  providers: [WarehouseSimulatorService],
  controllers: [AutomationSlottingController, AutomationStatusController],
  exports: [WarehouseSimulatorService],
})
export class AutomationModule {}
