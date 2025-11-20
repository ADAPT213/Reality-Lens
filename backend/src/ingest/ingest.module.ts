import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { ClarityModule } from '../clarity/clarity.module';

@Module({
  imports: [ClarityModule],
  controllers: [IngestController],
})
export class IngestModule {}
