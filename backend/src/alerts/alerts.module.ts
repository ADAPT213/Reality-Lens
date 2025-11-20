import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { RuleEngineService } from './rule-engine.service';
import { DeliveryService } from './delivery.service';
import { SimulatorService } from './simulator.service';
import { AlertsIntegration } from './alerts.integration';
import { CommonModule } from '../common/common.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [CommonModule, WebsocketModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    RuleEngineService,
    DeliveryService,
    SimulatorService,
    AlertsIntegration,
  ],
  exports: [AlertsService, AlertsIntegration],
})
export class AlertsModule {}
