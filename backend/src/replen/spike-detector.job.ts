import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { MovePlanType, MoveStatus } from '@prisma/client';

interface SpikeDetectionResult {
  skuId: string;
  skuCode: string;
  locationId: string;
  currentFrequency: number;
  baselineFrequency: number;
  spikeMultiplier: number;
}

@Injectable()
export class SpikeDetectorJob {
  private readonly logger = new Logger(SpikeDetectorJob.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private websocketGateway: WebsocketGateway,
  ) {}

  @Cron('*/30 * * * *', {
    name: 'spike-detector',
    timeZone: 'UTC',
  })
  async detectSpikes(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Spike detector is already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting spike detection job');

      const warehouses = await this.prisma.warehouse.findMany({
        select: { id: true, name: true },
      });

      let totalSpikesDetected = 0;

      for (const warehouse of warehouses) {
        const spikes = await this.detectWarehouseSpikes(warehouse.id);
        totalSpikesDetected += spikes.length;

        for (const spike of spikes) {
          await this.handleSpike(warehouse.id, spike);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Spike detection completed in ${duration}ms. Detected ${totalSpikesDetected} spikes across ${warehouses.length} warehouses`,
      );
    } catch (error) {
      this.logger.error(`Spike detection job failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async detectWarehouseSpikes(warehouseId: string): Promise<SpikeDetectionResult[]> {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const currentHour = now.getHours();

    const currentStats = await this.prisma.$queryRaw<
      Array<{
        sku_id: string;
        sku_code: string;
        location_id: string;
        pick_count: bigint;
      }>
    >`
      SELECT 
        sku_id,
        sku_code,
        location_id,
        COUNT(*) as pick_count
      FROM order_history
      WHERE warehouse_id = ${warehouseId}
        AND order_date >= ${fourHoursAgo}
      GROUP BY sku_id, sku_code, location_id
      HAVING COUNT(*) >= 5
    `;

    const baselineStats = await this.prisma.$queryRaw<
      Array<{
        sku_id: string;
        location_id: string;
        avg_picks: number;
      }>
    >`
      SELECT 
        sku_id,
        location_id,
        AVG(daily_picks) as avg_picks
      FROM (
        SELECT 
          sku_id,
          location_id,
          DATE(order_date) as pick_date,
          COUNT(*) as daily_picks
        FROM order_history
        WHERE warehouse_id = ${warehouseId}
          AND order_date >= ${sevenDaysAgo}
          AND order_date < ${fourHoursAgo}
          AND order_hour BETWEEN ${currentHour - 4} AND ${currentHour}
        GROUP BY sku_id, location_id, DATE(order_date)
      ) daily_stats
      GROUP BY sku_id, location_id
    `;

    const baselineMap = new Map<string, number>();
    for (const baseline of baselineStats) {
      const key = `${baseline.sku_id}:${baseline.location_id}`;
      baselineMap.set(key, baseline.avg_picks);
    }

    const spikes: SpikeDetectionResult[] = [];

    for (const current of currentStats) {
      const key = `${current.sku_id}:${current.location_id}`;
      const baseline = baselineMap.get(key) || 0;
      const currentFreq = Number(current.pick_count);

      if (baseline > 0) {
        const multiplier = currentFreq / baseline;

        if (multiplier >= 2.0) {
          spikes.push({
            skuId: current.sku_id,
            skuCode: current.sku_code,
            locationId: current.location_id,
            currentFrequency: currentFreq,
            baselineFrequency: baseline,
            spikeMultiplier: multiplier,
          });
        }
      } else if (currentFreq >= 10) {
        spikes.push({
          skuId: current.sku_id,
          skuCode: current.sku_code,
          locationId: current.location_id,
          currentFrequency: currentFreq,
          baselineFrequency: 0,
          spikeMultiplier: 999,
        });
      }
    }

    return spikes;
  }

  private async handleSpike(warehouseId: string, spike: SpikeDetectionResult) {
    const existingAlert = await this.prisma.spikeAlert.findFirst({
      where: {
        warehouseId,
        skuId: spike.skuId,
        currentLocationId: spike.locationId,
        resolvedAt: null,
      },
    });

    if (existingAlert) {
      await this.prisma.spikeAlert.update({
        where: { id: existingAlert.id },
        data: {
          currentFrequency: spike.currentFrequency,
          spikeMultiplier: spike.spikeMultiplier,
          detectedAt: new Date(),
        },
      });
      this.logger.debug(`Updated existing spike alert for SKU ${spike.skuCode}`);
      return;
    }

    const alert = await this.prisma.spikeAlert.create({
      data: {
        warehouseId,
        skuId: spike.skuId,
        skuCode: spike.skuCode,
        currentLocationId: spike.locationId,
        detectedAt: new Date(),
        baselineFrequency: spike.baselineFrequency,
        currentFrequency: spike.currentFrequency,
        spikeMultiplier: spike.spikeMultiplier,
      },
    });

    this.logger.log(
      `Spike detected: SKU ${spike.skuCode} spiked ${spike.spikeMultiplier.toFixed(1)}x (${spike.currentFrequency} vs ${spike.baselineFrequency} baseline)`,
    );

    const betterLocations = await this.findBetterLocations(warehouseId, spike.locationId);

    if (betterLocations.length > 0) {
      const bestLocation = betterLocations[0];

      const suggestedMove = await this.prisma.movePlan.create({
        data: {
          warehouseId,
          planType: MovePlanType.IN_SHIFT_SPIKE,
          priorityRank: 1,
          skuId: spike.skuId,
          skuCode: spike.skuCode,
          fromLocationId: spike.locationId,
          fromLocationLabel: await this.getLocationLabel(spike.locationId),
          toLocationId: bestLocation.id,
          toLocationLabel: bestLocation.label,
          quantity: { unit: 'pallets', value: 1 },
          effortMinutes: 20,
          expectedGain: {
            travelTimeSavedPerPick: 3.5,
            pickTimeSavedPerPick: 1.2,
            totalSecondsSaved: spike.currentFrequency * 4.7,
          },
          reasoning: `SPIKE ALERT: SKU ${spike.skuCode} spiked ${spike.spikeMultiplier.toFixed(1)}x. Emergency relocation recommended to optimal zone.`,
          status: MoveStatus.PENDING,
        },
      });

      await this.prisma.spikeAlert.update({
        where: { id: alert.id },
        data: { suggestedMoveId: suggestedMove.id },
      });

      this.emitSpikeAlert(warehouseId, alert, suggestedMove);
    }
  }

  private async findBetterLocations(warehouseId: string, currentLocationId: string) {
    const locations = await this.prisma.$queryRaw<
      Array<{ id: string; label: string; ergonomic_band: string }>
    >`
      SELECT pl.id, pl.label, lp.ergonomic_band
      FROM pick_locations pl
      JOIN zones z ON z.id = pl.zone_id
      JOIN location_properties lp ON lp.location_id = pl.id
      WHERE z.warehouse_id = ${warehouseId}
        AND pl.id != ${currentLocationId}
        AND lp.ergonomic_band = 'green'
      ORDER BY lp.distance_from_dock ASC
      LIMIT 3
    `;

    return locations;
  }

  private async getLocationLabel(locationId: string): Promise<string> {
    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { label: true },
    });
    return location?.label || locationId;
  }

  private emitSpikeAlert(warehouseId: string, alert: any, suggestedMove: any) {
    try {
      this.websocketGateway.server
        .to(`replen:warehouse:${warehouseId}`)
        .emit('replen:spike-detected', {
          alert: {
            id: alert.id,
            skuCode: alert.skuCode,
            spikeMultiplier: alert.spikeMultiplier,
            currentFrequency: alert.currentFrequency,
            baselineFrequency: alert.baselineFrequency,
          },
          suggestedMove: {
            id: suggestedMove.id,
            fromLocationLabel: suggestedMove.fromLocationLabel,
            toLocationLabel: suggestedMove.toLocationLabel,
            reasoning: suggestedMove.reasoning,
            expectedGain: suggestedMove.expectedGain,
          },
        });

      this.logger.log(`Emitted spike alert via WebSocket for warehouse ${warehouseId}`);
    } catch (error) {
      this.logger.error(`Failed to emit spike alert via WebSocket: ${error.message}`);
    }
  }

  async runManually(warehouseId?: string): Promise<any> {
    this.logger.log('Manual spike detection triggered');

    if (warehouseId) {
      const spikes = await this.detectWarehouseSpikes(warehouseId);
      for (const spike of spikes) {
        await this.handleSpike(warehouseId, spike);
      }
      return { warehouseId, spikesDetected: spikes.length, spikes };
    } else {
      await this.detectSpikes();
      return { message: 'Full spike detection completed' };
    }
  }
}
