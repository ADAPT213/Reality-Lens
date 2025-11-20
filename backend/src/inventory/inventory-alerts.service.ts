import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface InventoryAlert {
  id: string;
  type: 'INVENTORY_INEFFICIENCY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: {
    skuCode?: string;
    locationId?: string;
    opportunityCost?: number;
    extraStepsPerDay?: number;
  };
  triggeredAt: Date;
}

interface UnderutilizedLocation {
  locationId: string;
  label: string;
  currentSku?: string;
  pickFrequency: number;
  ergonomicScore: number;
  isPrimeLocation: boolean;
  opportunityCost: number;
}

@Injectable()
export class InventoryAlertsService {
  private readonly logger = new Logger(InventoryAlertsService.name);
  private readonly LOOKBACK_DAYS = 7;
  private readonly VELOCITY_SPIKE_THRESHOLD = 3.0;
  private readonly PRIME_LOCATION_THRESHOLD = 7.0;
  private readonly LOW_VELOCITY_THRESHOLD = 5;

  constructor(private readonly prisma: PrismaService) {}

  async detectInefficiencies(warehouseId: string): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = [];

    const velocitySpikes = await this.detectVelocitySpikes(warehouseId);
    alerts.push(...velocitySpikes);

    const underutilizedPrime = await this.detectUnderutilizedPrimeLocations(warehouseId);
    alerts.push(...underutilizedPrime);

    for (const alert of alerts) {
      await this.persistAlert(warehouseId, alert);
    }

    this.logger.log(
      `Detected ${alerts.length} inventory inefficiencies for warehouse ${warehouseId}`,
    );

    return alerts;
  }

  async getAlerts(warehouseId: string, limit = 50): Promise<InventoryAlert[]> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const dbAlerts = await this.prisma.alert.findMany({
      where: {
        warehouseId,
        createdByRule: 'INVENTORY_INEFFICIENCY',
        triggeredAt: { gte: yesterday },
        resolvedAt: null,
      },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });

    return dbAlerts.map((a) => ({
      id: a.id,
      type: 'INVENTORY_INEFFICIENCY' as const,
      severity: a.severity as any,
      title: a.title,
      message: a.message,
      metadata: {},
      triggeredAt: a.triggeredAt,
    }));
  }

  async getUnderutilizedLocations(warehouseId: string): Promise<UnderutilizedLocation[]> {
    const since = new Date(Date.now() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: {
        pickLocations: {
          select: {
            id: true,
            label: true,
            xCoord: true,
            yCoord: true,
            zHeightCm: true,
            assignments: {
              where: {
                OR: [{ toTs: null }, { toTs: { gte: since } }],
              },
              orderBy: { fromTs: 'desc' },
              take: 1,
              select: {
                avgPicksPerHour: true,
                sku: {
                  select: {
                    skuCode: true,
                  },
                },
              },
            },
            ergonomicSnapshots: {
              where: {
                timestamp: { gte: since },
                compositeRisk: { not: null },
              },
              select: {
                compositeRisk: true,
              },
            },
          },
        },
      },
    });

    const allLocations = zones.flatMap((z) => z.pickLocations);
    const underutilized: UnderutilizedLocation[] = [];

    for (const loc of allLocations) {
      const avgRisk =
        loc.ergonomicSnapshots.length > 0
          ? loc.ergonomicSnapshots.reduce((sum, s) => sum + Number(s.compositeRisk), 0) /
            loc.ergonomicSnapshots.length
          : 5.0;

      const ergonomicScore = 10 - avgRisk;
      const isPrime = ergonomicScore >= this.PRIME_LOCATION_THRESHOLD;

      const pickFrequency = loc.assignments[0]?.avgPicksPerHour
        ? Number(loc.assignments[0].avgPicksPerHour)
        : 0;

      const isLowVelocity = pickFrequency < this.LOW_VELOCITY_THRESHOLD;

      if (isPrime && isLowVelocity) {
        const opportunityCost =
          (ergonomicScore / 10) * (this.LOW_VELOCITY_THRESHOLD - pickFrequency) * 8;

        underutilized.push({
          locationId: loc.id,
          label: loc.label,
          currentSku: loc.assignments[0]?.sku.skuCode,
          pickFrequency,
          ergonomicScore,
          isPrimeLocation: isPrime,
          opportunityCost: Math.round(opportunityCost),
        });
      }
    }

    return underutilized.sort((a, b) => b.opportunityCost - a.opportunityCost);
  }

  private async detectVelocitySpikes(warehouseId: string): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = [];
    const since = new Date(Date.now() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const comparisonPeriod = new Date(Date.now() - this.LOOKBACK_DAYS * 2 * 24 * 60 * 60 * 1000);

    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: {
        pickLocations: {
          select: {
            id: true,
            label: true,
            xCoord: true,
            yCoord: true,
            assignments: {
              where: {
                OR: [{ toTs: null }, { toTs: { gte: comparisonPeriod } }],
              },
              orderBy: { fromTs: 'desc' },
              take: 2,
              select: {
                avgPicksPerHour: true,
                fromTs: true,
                sku: {
                  select: {
                    skuCode: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const allLocations = zones.flatMap((z) => z.pickLocations);

    for (const loc of allLocations) {
      if (loc.assignments.length < 2) continue;

      const [current, previous] = loc.assignments;
      const currentVelocity = Number(current.avgPicksPerHour || 0);
      const previousVelocity = Number(previous.avgPicksPerHour || 0);

      if (previousVelocity === 0) continue;

      const velocityRatio = currentVelocity / previousVelocity;

      if (velocityRatio >= this.VELOCITY_SPIKE_THRESHOLD) {
        const distance = Math.sqrt(
          Math.pow(Number(loc.xCoord || 0), 2) + Math.pow(Number(loc.yCoord || 0), 2),
        );
        const extraSteps = Math.round(distance * currentVelocity * 8);

        const isBackRow = distance > 50;

        if (isBackRow) {
          alerts.push({
            id: `velocity-spike-${loc.id}-${Date.now()}`,
            type: 'INVENTORY_INEFFICIENCY',
            severity: extraSteps > 1000 ? 'high' : 'medium',
            title: `Velocity Spiked ${Math.round(velocityRatio)}x - Suboptimal Location`,
            message: `SKU ${current.sku.skuCode} velocity increased ${Math.round(velocityRatio)}x but remains in back row location ${loc.label}. Costing ~${extraSteps} extra steps/day.`,
            metadata: {
              skuCode: current.sku.skuCode,
              locationId: loc.id,
              extraStepsPerDay: extraSteps,
            },
            triggeredAt: new Date(),
          });
        }
      }
    }

    return alerts;
  }

  private async detectUnderutilizedPrimeLocations(warehouseId: string): Promise<InventoryAlert[]> {
    const underutilized = await this.getUnderutilizedLocations(warehouseId);

    return underutilized
      .filter((u) => u.opportunityCost > 50)
      .map((u) => ({
        id: `underutilized-${u.locationId}-${Date.now()}`,
        type: 'INVENTORY_INEFFICIENCY' as const,
        severity: (u.opportunityCost > 200 ? 'high' : 'medium') as any,
        title: 'Prime Location Underutilized',
        message: `Location ${u.label} (prime green zone) holds ${u.currentSku || 'no SKU'} with only ${u.pickFrequency.toFixed(1)} picks/hr. Opportunity cost: ~${u.opportunityCost} wasted picks/day.`,
        metadata: {
          skuCode: u.currentSku,
          locationId: u.locationId,
          opportunityCost: u.opportunityCost,
        },
        triggeredAt: new Date(),
      }));
  }

  private async persistAlert(warehouseId: string, alert: InventoryAlert): Promise<void> {
    try {
      await this.prisma.alert.create({
        data: {
          id: alert.id,
          warehouseId,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          triggeredAt: alert.triggeredAt,
          createdByRule: 'INVENTORY_INEFFICIENCY',
        },
      });
    } catch (error: any) {
      if (!error?.code?.includes('P2002')) {
        this.logger.error(`Failed to persist alert ${alert.id}: ${error?.message}`);
      }
    }
  }
}
