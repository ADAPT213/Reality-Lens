import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { SimulatorService } from './simulator.service';

@Injectable()
export class AlertsIntegration implements OnModuleInit {
  private readonly logger = new Logger(AlertsIntegration.name);

  constructor(
    private alertsService: AlertsService,
    private simulator: SimulatorService,
  ) {}

  onModuleInit() {
    this.logger.log('Alerts integration initialized');
  }

  async handleShiftSnapshot(snapshot: any): Promise<void> {
    this.simulator.recordEvent(snapshot);

    await this.alertsService.processEvent({
      type: 'SHIFT_SNAPSHOT',
      warehouseId: snapshot.warehouseId,
      zoneId: snapshot.zoneId,
      shiftCode: snapshot.shiftCode,
      timestamp: snapshot.timestamp,
      metrics: snapshot.metrics || snapshot,
    });
  }

  async handleErgonomicSnapshot(snapshot: any): Promise<void> {
    this.simulator.recordEvent(snapshot);

    await this.alertsService.processEvent({
      type: 'ERGONOMIC_SNAPSHOT',
      warehouseId: snapshot.warehouseId,
      zoneId: snapshot.zoneId,
      shiftCode: snapshot.shiftCode,
      pickLocationId: snapshot.pickLocationId,
      timestamp: snapshot.timestamp,
      metrics: {
        rulaScore: snapshot.rulaScore,
        rebaScore: snapshot.rebaScore,
        nioshIndex: snapshot.nioshIndex,
        compositeRisk: snapshot.compositeRisk,
        trafficLight: snapshot.trafficLight,
      },
    });
  }
}
