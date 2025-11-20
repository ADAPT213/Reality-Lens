import { Module } from '@nestjs/common';
import { StreamProducerService } from './producer.service';
import { StreamsController } from './streams.controller';
import { CommonModule } from '../common/common.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [CommonModule, WorkersModule],
  controllers: [StreamsController],
  providers: [StreamProducerService],
  exports: [StreamProducerService],
})
export class StreamsModule {}
