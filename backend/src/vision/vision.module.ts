import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { VisionController } from './vision.controller';
import { VisionService } from './vision.service';
import { ClarityModule } from '../clarity/clarity.module';
import { SlottingModule } from '../slotting/slotting.module';

@Module({
  imports: [CommonModule, ClarityModule, SlottingModule],
  controllers: [VisionController],
  providers: [VisionService],
})
export class VisionModule {}
