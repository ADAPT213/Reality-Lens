import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ClarityController } from './clarity.controller';
import { ClarityEventsService } from './events.service';
import { ClarityMetricsService } from './metrics.service';
import { GuidanceService } from './guidance.service';
import { PlaybooksService } from './playbooks.service';
import { MachineMathService } from './machine-math.service';

@Module({
  imports: [CommonModule],
  providers: [
    ClarityEventsService,
    ClarityMetricsService,
    GuidanceService,
    PlaybooksService,
    MachineMathService,
  ],
  controllers: [ClarityController],
  exports: [ClarityEventsService, ClarityMetricsService, GuidanceService],
})
export class ClarityModule {}
