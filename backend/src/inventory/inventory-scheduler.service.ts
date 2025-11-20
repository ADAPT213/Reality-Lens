import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { InventoryAlertsService } from './inventory-alerts.service';
import { InventoryHeatmapService } from './heatmap.service';

@Injectable()
export class InventorySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InventorySchedulerService.name);
  private readonly SCAN_INTERVAL_MS = 5 * 60 * 1000;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: InventoryAlertsService,
    private readonly heatmapService: InventoryHeatmapService,
  ) {}

  onModuleInit() {
    this.startScheduler();
  }

  private startScheduler() {
    this.logger.log('Starting inventory efficiency scheduler (5-minute interval)');

    this.runScan();

    this.intervalHandle = setInterval(() => {
      this.runScan();
    }, this.SCAN_INTERVAL_MS);
  }

  private async runScan() {
    try {
      const warehouses = await this.prisma.warehouse.findMany({
        select: { id: true, name: true },
      });

      for (const warehouse of warehouses) {
        this.logger.debug(`Scanning warehouse ${warehouse.name} for inefficiencies`);

        await this.heatmapService.generateHeatmap(warehouse.id);

        const alerts = await this.alertsService.detectInefficiencies(warehouse.id);

        if (alerts.length > 0) {
          this.logger.log(`Detected ${alerts.length} inefficiencies in ${warehouse.name}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error during inventory scan: ${error?.message}`);
    }
  }

  async stopScheduler() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Stopped inventory efficiency scheduler');
    }
  }
}
