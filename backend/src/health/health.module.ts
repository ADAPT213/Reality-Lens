import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CopilotModule } from '../copilot/copilot.module';

@Module({
  imports: [CopilotModule],
  controllers: [HealthController],
})
export class HealthModule {}
