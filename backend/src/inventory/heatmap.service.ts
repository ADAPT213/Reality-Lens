import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

interface HeatmapLayer {
  name: string;
  values: Map<string, number>;
  min: number;
  max: number;
  colorScale: string;
}

interface LocationMetrics {
  locationId: string;
  label: string;
  currentSku?: string;
  pickFrequency: number;
  ergonomicScore: number;
  travelCost: number;
  efficiencyRating: number;
  x: number;
  y: number;
  z: number;
}

interface WarehouseHeatmap {
  warehouseId: string;
  generatedAt: Date;
  locations: LocationMetrics[];
  layers: {
    pickFrequency: HeatmapLayer;
    travelCost: HeatmapLayer;
    ergonomicBand: HeatmapLayer;
    efficiencyMismatch: HeatmapLayer;
  };
}

@Injectable()
export class InventoryHeatmapService {
  private readonly logger = new Logger(InventoryHeatmapService.name);
  private readonly CACHE_TTL = 300;
  private readonly LOOKBACK_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async generateHeatmap(warehouseId: string): Promise<WarehouseHeatmap> {
    const cacheKey = `inventory:heatmap:${warehouseId}`;
    const redis = this.redis.getPublisher();

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for heatmap ${warehouseId}`);
        return JSON.parse(cached);
      }
    }

    const locations = await this.getLocationMetrics(warehouseId);

    const pickFrequencyLayer = this.buildPickFrequencyLayer(locations);
    const travelCostLayer = this.buildTravelCostLayer(locations);
    const ergonomicBandLayer = this.buildErgonomicBandLayer(locations);
    const efficiencyMismatchLayer = this.buildEfficiencyMismatchLayer(locations);

    const heatmap: WarehouseHeatmap = {
      warehouseId,
      generatedAt: new Date(),
      locations,
      layers: {
        pickFrequency: pickFrequencyLayer,
        travelCost: travelCostLayer,
        ergonomicBand: ergonomicBandLayer,
        efficiencyMismatch: efficiencyMismatchLayer,
      },
    };

    if (redis) {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(heatmap));
      this.logger.debug(`Cached heatmap for ${warehouseId} with ${this.CACHE_TTL}s TTL`);
    }

    return heatmap;
  }

  private async getLocationMetrics(warehouseId: string): Promise<LocationMetrics[]> {
    const since = new Date(Date.now() - this.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: {
        id: true,
        pickLocations: {
          select: {
            id: true,
            label: true,
            xCoord: true,
            yCoord: true,
            zHeightCm: true,
            reachBand: true,
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
    const warehouseBounds = this.calculateWarehouseBounds(allLocations);

    return allLocations.map((loc) => {
      const currentAssignment = loc.assignments[0];
      const pickFrequency = currentAssignment?.avgPicksPerHour
        ? Number(currentAssignment.avgPicksPerHour)
        : 0;

      const avgRisk =
        loc.ergonomicSnapshots.length > 0
          ? loc.ergonomicSnapshots.reduce((sum, s) => sum + Number(s.compositeRisk), 0) /
            loc.ergonomicSnapshots.length
          : 5.0;

      const ergonomicScore = 10 - avgRisk;

      const travelCost = this.calculateTravelCost(
        { x: Number(loc.xCoord || 0), y: Number(loc.yCoord || 0) },
        warehouseBounds.optimalCenter,
      );

      const efficiencyRating = this.calculateEfficiencyRating(
        pickFrequency,
        travelCost,
        ergonomicScore,
      );

      return {
        locationId: loc.id,
        label: loc.label,
        currentSku: currentAssignment?.sku.skuCode,
        pickFrequency,
        ergonomicScore,
        travelCost,
        efficiencyRating,
        x: Number(loc.xCoord || 0),
        y: Number(loc.yCoord || 0),
        z: Number(loc.zHeightCm || 0),
      };
    });
  }

  private calculateWarehouseBounds(locations: any[]): { optimalCenter: { x: number; y: number } } {
    if (locations.length === 0) {
      return { optimalCenter: { x: 0, y: 0 } };
    }

    const coords = locations.map((l) => ({
      x: Number(l.xCoord || 0),
      y: Number(l.yCoord || 0),
    }));

    const centerX = coords.reduce((sum, c) => sum + c.x, 0) / coords.length;
    const centerY = coords.reduce((sum, c) => sum + c.y, 0) / coords.length;

    return { optimalCenter: { x: centerX, y: centerY } };
  }

  private calculateTravelCost(
    point: { x: number; y: number },
    center: { x: number; y: number },
  ): number {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateEfficiencyRating(
    pickFrequency: number,
    travelCost: number,
    ergonomicScore: number,
  ): number {
    const normalizedFreq = Math.min(pickFrequency / 50, 1);
    const normalizedTravel = Math.min(travelCost / 100, 1);
    const normalizedErgo = ergonomicScore / 10;

    const desirability = normalizedFreq * 0.6 + normalizedErgo * 0.4;
    const accessibility = 1 - normalizedTravel;

    const efficiency = desirability - (1 - accessibility);

    return Math.max(-1, Math.min(1, efficiency));
  }

  private buildPickFrequencyLayer(locations: LocationMetrics[]): HeatmapLayer {
    const values = new Map<string, number>();
    const freqs = locations.map((l) => l.pickFrequency);
    const min = Math.min(...freqs);
    const max = Math.max(...freqs);

    locations.forEach((loc) => {
      values.set(loc.locationId, loc.pickFrequency);
    });

    return {
      name: 'Pick Frequency',
      values,
      min,
      max,
      colorScale: 'blue-to-red',
    };
  }

  private buildTravelCostLayer(locations: LocationMetrics[]): HeatmapLayer {
    const values = new Map<string, number>();
    const costs = locations.map((l) => l.travelCost);
    const min = Math.min(...costs);
    const max = Math.max(...costs);

    locations.forEach((loc) => {
      values.set(loc.locationId, loc.travelCost);
    });

    return {
      name: 'Travel Cost',
      values,
      min,
      max,
      colorScale: 'green-to-red',
    };
  }

  private buildErgonomicBandLayer(locations: LocationMetrics[]): HeatmapLayer {
    const values = new Map<string, number>();

    locations.forEach((loc) => {
      const band = loc.ergonomicScore >= 7 ? 3 : loc.ergonomicScore >= 4 ? 2 : 1;
      values.set(loc.locationId, band);
    });

    return {
      name: 'Ergonomic Band',
      values,
      min: 1,
      max: 3,
      colorScale: 'red-yellow-green',
    };
  }

  private buildEfficiencyMismatchLayer(locations: LocationMetrics[]): HeatmapLayer {
    const values = new Map<string, number>();

    locations.forEach((loc) => {
      values.set(loc.locationId, loc.efficiencyRating);
    });

    return {
      name: 'Efficiency Mismatch',
      values,
      min: -1,
      max: 1,
      colorScale: 'red-white-green',
    };
  }
}
