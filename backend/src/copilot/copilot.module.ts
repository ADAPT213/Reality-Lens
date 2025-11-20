import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { ClarityModule } from '../clarity/clarity.module';
import { CommonModule } from '../common/common.module';

@Module({
  // Include CommonModule (global) explicitly for clarity to ensure Prisma/Redis services present
  imports: [CommonModule, ClarityModule],
  providers: [CopilotService],
  controllers: [CopilotController],
  exports: [CopilotService],
})
export class CopilotModule {}
