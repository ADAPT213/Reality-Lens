import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { MaterializedViewsService } from './materialized-views.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PrismaService, MaterializedViewsService],
  exports: [MaterializedViewsService],
})
export class DatabaseModule {}
