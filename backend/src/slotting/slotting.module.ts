import { Module } from '@nestjs/common';
import { SlottingController } from './slotting.controller';
import { SlottingService } from './slotting.service';
import { CommonModule } from '../common/common.module';
import { ClarityModule } from '../clarity/clarity.module';

@Module({
  imports: [CommonModule, ClarityModule],
  controllers: [SlottingController],
  providers: [SlottingService],
  exports: [SlottingService],
})
export class SlottingModule {}
