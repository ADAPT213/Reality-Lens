import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

interface ViewRefreshConfig {
  name: string;
  refreshInterval: number; // milliseconds
  priority: number; // 1 = highest
  concurrent: boolean;
}

@Injectable()
export class MaterializedViewsService implements OnModuleInit {
  private readonly logger = new Logger(MaterializedViewsService.name);
  private readonly views: ViewRefreshConfig[] = [
    {
      name: 'rollup_1m',
      refreshInterval: 60_000, // 1 minute
      priority: 1,
      concurrent: true,
    },
    {
      name: 'rollup_5m',
      refreshInterval: 300_000, // 5 minutes
      priority: 2,
      concurrent: true,
    },
    {
      name: 'top_red_zones',
      refreshInterval: 300_000, // 5 minutes
      priority: 2,
      concurrent: true,
    },
    {
      name: 'worker_exposure_minutes',
      refreshInterval: 600_000, // 10 minutes
      priority: 3,
      concurrent: true,
    },
    {
      name: 'posture_type_counts',
      refreshInterval: 900_000, // 15 minutes
      priority: 3,
      concurrent: true,
    },
  ];

  private lastRefresh: Map<string, Date> = new Map();
  private refreshing: Set<string> = new Set();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Materialized Views Service initialized');
    // Initial refresh on startup
    await this.refreshAllViews();
  }

  /**
   * Refresh all materialized views
   */
  async refreshAllViews(): Promise<void> {
    this.logger.log('Starting refresh of all materialized views');
    const startTime = Date.now();

    // Sort by priority
    const sortedViews = [...this.views].sort((a, b) => a.priority - b.priority);

    for (const view of sortedViews) {
      try {
        await this.refreshView(view.name, view.concurrent);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to refresh view ${view.name}: ${errorMessage}`, errorStack);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Completed refresh of all views in ${duration}ms`);
  }

  /**
   * Refresh a specific materialized view
   */
  async refreshView(viewName: string, concurrent = true): Promise<void> {
    // Check if already refreshing
    if (this.refreshing.has(viewName)) {
      this.logger.debug(`View ${viewName} is already refreshing, skipping`);
      return;
    }

    this.refreshing.add(viewName);
    const startTime = Date.now();

    try {
      const sql = concurrent
        ? `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
        : `REFRESH MATERIALIZED VIEW ${viewName}`;

      await this.prisma.$executeRawUnsafe(sql);

      const duration = Date.now() - startTime;
      this.lastRefresh.set(viewName, new Date());

      this.logger.debug(`Refreshed view ${viewName} in ${duration}ms (concurrent=${concurrent})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error refreshing view ${viewName}: ${errorMessage}`, errorStack);
      throw error;
    } finally {
      this.refreshing.delete(viewName);
    }
  }

  /**
   * Scheduled job: Refresh high-priority views every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshHighPriorityViews(): Promise<void> {
    const highPriorityViews = this.views.filter((v) => v.priority === 1);

    for (const view of highPriorityViews) {
      if (this.shouldRefresh(view)) {
        this.refreshView(view.name, view.concurrent).catch((err) => {
          this.logger.error(`Scheduled refresh failed for ${view.name}:`, err);
        });
      }
    }
  }

  /**
   * Scheduled job: Refresh medium-priority views every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshMediumPriorityViews(): Promise<void> {
    const mediumPriorityViews = this.views.filter((v) => v.priority === 2);

    for (const view of mediumPriorityViews) {
      if (this.shouldRefresh(view)) {
        this.refreshView(view.name, view.concurrent).catch((err) => {
          this.logger.error(`Scheduled refresh failed for ${view.name}:`, err);
        });
      }
    }
  }

  /**
   * Scheduled job: Refresh low-priority views every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async refreshLowPriorityViews(): Promise<void> {
    const lowPriorityViews = this.views.filter((v) => v.priority === 3);

    for (const view of lowPriorityViews) {
      if (this.shouldRefresh(view)) {
        this.refreshView(view.name, view.concurrent).catch((err) => {
          this.logger.error(`Scheduled refresh failed for ${view.name}:`, err);
        });
      }
    }
  }

  /**
   * Check if a view should be refreshed based on its interval
   */
  private shouldRefresh(view: ViewRefreshConfig): boolean {
    const lastRefreshTime = this.lastRefresh.get(view.name);
    if (!lastRefreshTime) {
      return true; // Never refreshed
    }

    const timeSinceRefresh = Date.now() - lastRefreshTime.getTime();
    return timeSinceRefresh >= view.refreshInterval;
  }

  /**
   * Get refresh status for all views
   */
  getRefreshStatus(): Array<{
    name: string;
    lastRefresh: Date | null;
    isRefreshing: boolean;
    priority: number;
  }> {
    return this.views.map((view) => ({
      name: view.name,
      lastRefresh: this.lastRefresh.get(view.name) || null,
      isRefreshing: this.refreshing.has(view.name),
      priority: view.priority,
    }));
  }

  /**
   * Query a materialized view
   */
  async queryView<T = any>(viewName: string, whereClause?: string, params?: any[]): Promise<T[]> {
    try {
      let sql = `SELECT * FROM ${viewName}`;
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }

      const result = params
        ? ((await this.prisma.$queryRawUnsafe(sql, ...params)) as T[])
        : ((await this.prisma.$queryRawUnsafe(sql)) as T[]);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error querying view ${viewName}: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get 1-minute rollup data
   */
  async getRollup1m(warehouseId: string, startTime: Date, endTime: Date): Promise<any[]> {
    return this.queryView(
      'rollup_1m',
      'warehouse_id = $1 AND bucket_time >= $2 AND bucket_time <= $3 ORDER BY bucket_time DESC',
      [warehouseId, startTime, endTime],
    );
  }

  /**
   * Get 5-minute rollup data
   */
  async getRollup5m(warehouseId: string, startTime: Date, endTime: Date): Promise<any[]> {
    return this.queryView(
      'rollup_5m',
      'warehouse_id = $1 AND bucket_time >= $2 AND bucket_time <= $3 ORDER BY bucket_time DESC',
      [warehouseId, startTime, endTime],
    );
  }

  /**
   * Get top red zones
   */
  async getTopRedZones(warehouseId?: string, limit = 20): Promise<any[]> {
    if (warehouseId) {
      return this.queryView(
        'top_red_zones',
        'warehouse_id = $1 ORDER BY priority_score DESC LIMIT $2',
        [warehouseId, limit],
      );
    }
    return this.queryView('top_red_zones', `ORDER BY priority_score DESC LIMIT ${limit}`);
  }

  /**
   * Get worker exposure data
   */
  async getWorkerExposure(warehouseId: string, startTime: Date, endTime: Date): Promise<any[]> {
    return this.queryView(
      'worker_exposure_minutes',
      'warehouse_id = $1 AND hour_bucket >= $2 AND hour_bucket <= $3 ORDER BY hour_bucket DESC',
      [warehouseId, startTime, endTime],
    );
  }

  /**
   * Get posture type distribution
   */
  async getPostureTypeCounts(warehouseId: string, startTime: Date, endTime: Date): Promise<any[]> {
    return this.queryView(
      'posture_type_counts',
      'warehouse_id = $1 AND hour_bucket >= $2 AND hour_bucket <= $3 ORDER BY hour_bucket DESC',
      [warehouseId, startTime, endTime],
    );
  }
}
