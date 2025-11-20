import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from '../common/common.module';
import { OptimizationModule } from '../optimization/optimization.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { MovePlannerService } from './move-planner.service';
import { ReplenController } from './replen.controller';
import { SpikeDetectorJob } from './spike-detector.job';
import { ReplenGateway } from './replen.gateway';

@Module({
  imports: [CommonModule, OptimizationModule, WebsocketModule, ScheduleModule.forRoot()],
  providers: [MovePlannerService, SpikeDetectorJob, ReplenGateway],
  controllers: [ReplenController],
  exports: [MovePlannerService, SpikeDetectorJob],
})
export class ReplenModule {}
