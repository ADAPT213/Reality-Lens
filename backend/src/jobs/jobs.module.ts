import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { DataRetentionJob } from './data-retention.job';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PrismaService, DataRetentionJob],
  exports: [DataRetentionJob],
})
export class JobsModule {}
