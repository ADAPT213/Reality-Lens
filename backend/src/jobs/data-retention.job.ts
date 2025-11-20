import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';

interface RetentionStats {
  warehouseId: string;
  warehouseName: string;
  retentionDays: number;
  cutoffDate: Date;
  ergonomicSnapshotsDeleted: number;
  shiftSnapshotsDeleted: number;
  totalDeleted: number;
  duration: number;
}

@Injectable()
export class DataRetentionJob {
  private readonly logger = new Logger(DataRetentionJob.name);
  private isRunning = false;

  constructor(private prisma: PrismaService) {}

  /**
   * Run data retention job daily at 2 AM
   */
  @Cron('0 2 * * *', {
    name: 'data-retention',
    timeZone: 'UTC',
  })
  async handleDataRetention(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Data retention job is already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting data retention job');
      const stats = await this.purgeOldData();
      const duration = Date.now() - startTime;

      this.logger.log(
        `Data retention job completed in ${duration}ms. Total records deleted: ${stats.reduce((sum, s) => sum + s.totalDeleted, 0)}`,
      );

      // Log details for each warehouse
      stats.forEach((stat) => {
        if (stat.totalDeleted > 0) {
          this.logger.log(
            `Warehouse ${stat.warehouseName} (${stat.warehouseId}): ` +
              `Deleted ${stat.ergonomicSnapshotsDeleted} ergonomic snapshots, ` +
              `${stat.shiftSnapshotsDeleted} shift snapshots ` +
              `(retention: ${stat.retentionDays} days, cutoff: ${stat.cutoffDate.toISOString()})`,
          );
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Data retention job failed: ${err.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Purge old data for all warehouses
   */
  async purgeOldData(): Promise<RetentionStats[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        retentionDays: true,
      },
    });

    const stats: RetentionStats[] = [];

    for (const warehouse of warehouses) {
      const warehouseStats = await this.purgeWarehouseData(
        warehouse.id,
        warehouse.name,
        warehouse.retentionDays || 90,
      );
      stats.push(warehouseStats);
    }

    return stats;
  }

  /**
   * Purge old data for a specific warehouse
   */
  async purgeWarehouseData(
    warehouseId: string,
    warehouseName: string,
    retentionDays: number,
  ): Promise<RetentionStats> {
    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.debug(
      `Purging data for warehouse ${warehouseName} (${warehouseId}) ` +
        `older than ${cutoffDate.toISOString()} (${retentionDays} days retention)`,
    );

    // Delete old ergonomic snapshots
    const ergonomicResult = await this.prisma.ergonomicSnapshot.deleteMany({
      where: {
        warehouseId: warehouseId,
        eventTime: {
          lt: cutoffDate,
        },
      },
    });

    // Delete old shift snapshots
    const shiftResult = await this.prisma.shiftSnapshot.deleteMany({
      where: {
        warehouseId: warehouseId,
        eventTime: {
          lt: cutoffDate,
        },
      },
    });

    const duration = Date.now() - startTime;

    return {
      warehouseId,
      warehouseName,
      retentionDays,
      cutoffDate,
      ergonomicSnapshotsDeleted: ergonomicResult.count,
      shiftSnapshotsDeleted: shiftResult.count,
      totalDeleted: ergonomicResult.count + shiftResult.count,
      duration,
    };
  }

  /**
   * Purge old alerts (optional - keep alerts for longer)
   */
  async purgeOldAlerts(retentionDays = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.debug(`Purging resolved alerts older than ${cutoffDate.toISOString()}`);

    const result = await this.prisma.alert.deleteMany({
      where: {
        resolvedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} old resolved alerts`);
    return result.count;
  }

  /**
   * Get retention statistics for all warehouses
   */
  async getRetentionStatistics(): Promise<
    Array<{
      warehouseId: string;
      warehouseName: string;
      retentionDays: number;
      totalErgonomicSnapshots: number;
      totalShiftSnapshots: number;
      oldestErgonomicSnapshot: Date | null;
      newestErgonomicSnapshot: Date | null;
      dataSpanDays: number | null;
      estimatedDeletableRecords: number;
    }>
  > {
    const warehouses = await this.prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        retentionDays: true,
      },
    });

    const stats = [];

    for (const warehouse of warehouses) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (warehouse.retentionDays || 90));

      // Count total snapshots
      const totalErgonomic = await this.prisma.ergonomicSnapshot.count({
        where: { warehouseId: warehouse.id },
      });

      const totalShift = await this.prisma.shiftSnapshot.count({
        where: { warehouseId: warehouse.id },
      });

      // Get date range
      const dateRange = await this.prisma.ergonomicSnapshot.aggregate({
        where: { warehouseId: warehouse.id },
        _min: { eventTime: true },
        _max: { eventTime: true },
      });

      // Count deletable records
      const deletableErgonomic = await this.prisma.ergonomicSnapshot.count({
        where: {
          warehouseId: warehouse.id,
          eventTime: { lt: cutoffDate },
        },
      });

      const deletableShift = await this.prisma.shiftSnapshot.count({
        where: {
          warehouseId: warehouse.id,
          eventTime: { lt: cutoffDate },
        },
      });

      const dataSpanDays =
        dateRange._min.eventTime && dateRange._max.eventTime
          ? Math.floor(
              (dateRange._max.eventTime.getTime() - dateRange._min.eventTime.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

      stats.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        retentionDays: warehouse.retentionDays || 90,
        totalErgonomicSnapshots: totalErgonomic,
        totalShiftSnapshots: totalShift,
        oldestErgonomicSnapshot: dateRange._min.eventTime,
        newestErgonomicSnapshot: dateRange._max.eventTime,
        dataSpanDays,
        estimatedDeletableRecords: deletableErgonomic + deletableShift,
      });
    }

    return stats;
  }

  /**
   * Vacuum and analyze tables after large deletes (manual trigger)
   */
  async optimizeTables(): Promise<void> {
    this.logger.log('Running VACUUM ANALYZE on time-series tables');

    try {
      await this.prisma.$executeRawUnsafe('VACUUM ANALYZE ergonomic_snapshots');
      await this.prisma.$executeRawUnsafe('VACUUM ANALYZE shift_snapshots');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Table optimization failed: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Manual trigger for data retention (for testing or admin use)
   */
  async runManually(): Promise<RetentionStats[]> {
    this.logger.log('Manual data retention triggered');
    return this.purgeOldData();
  }
}
