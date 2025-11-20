import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

interface Coordinate {
  x: number;
  y: number;
}

interface HeatmapCell {
  x: number;
  y: number;
  riskDensity: number;
  exposureCount: number;
  avgRisk: number;
  maxRisk: number;
}

interface SpatialHeatmap {
  warehouseId: string;
  zoneId?: string;
  gridSize: number;
  cells: HeatmapCell[];
  generatedAt: Date;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

interface HotspotZone {
  centerX: number;
  centerY: number;
  radius: number;
  avgRisk: number;
  exposureCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class HeatmapService {
  private readonly logger = new Logger(HeatmapService.name);
  private readonly DEFAULT_GRID_SIZE = 50;
  private readonly HEATMAP_TTL = 60;
  private readonly HOTSPOT_THRESHOLD = 0.7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async generateHeatmap(
    warehouseId: string,
    gridSize: number = this.DEFAULT_GRID_SIZE,
    zoneId?: string,
  ): Promise<SpatialHeatmap> {
    const now = new Date();
    const since = new Date(now.getTime() - 60 * 60 * 1000);

    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        warehouseId,
        zoneId: zoneId || undefined,
        timestamp: { gte: since },
        compositeRisk: { not: null },
        pickLocationId: { not: null },
      },
      select: {
        compositeRisk: true,
        pickLocation: {
          select: {
            xCoord: true,
            yCoord: true,
          },
        },
      },
    });

    if (snapshots.length === 0) {
      return this.getEmptyHeatmap(warehouseId, gridSize, zoneId);
    }

    const coordinates = snapshots
      .filter((s) => s.pickLocation && s.pickLocation.xCoord && s.pickLocation.yCoord)
      .map((s) => ({
        x: Number(s.pickLocation!.xCoord),
        y: Number(s.pickLocation!.yCoord),
        risk: Number(s.compositeRisk),
      }));

    const bounds = this.calculateBounds(coordinates);
    const cells = this.spatialBinning(coordinates, bounds, gridSize);

    const heatmap: SpatialHeatmap = {
      warehouseId,
      zoneId,
      gridSize,
      cells,
      generatedAt: now,
      bounds,
    };

    await this.cacheHeatmap(heatmap);
    return heatmap;
  }

  async identifyHotspots(warehouseId: string, zoneId?: string): Promise<HotspotZone[]> {
    const heatmap = await this.getHeatmap(warehouseId, zoneId);
    const hotspots: HotspotZone[] = [];

    const highRiskCells = heatmap.cells
      .filter((cell) => cell.avgRisk >= this.HOTSPOT_THRESHOLD)
      .sort((a, b) => b.riskDensity - a.riskDensity);

    for (const cell of highRiskCells) {
      const neighbors = this.findNeighboringCells(cell, heatmap.cells, heatmap.gridSize);
      const cluster = [cell, ...neighbors.filter((n) => n.avgRisk >= this.HOTSPOT_THRESHOLD)];

      if (cluster.length >= 3) {
        const centerX = cluster.reduce((sum, c) => sum + c.x, 0) / cluster.length;
        const centerY = cluster.reduce((sum, c) => sum + c.y, 0) / cluster.length;
        const avgRisk = cluster.reduce((sum, c) => sum + c.avgRisk, 0) / cluster.length;
        const exposureCount = cluster.reduce((sum, c) => sum + c.exposureCount, 0);

        hotspots.push({
          centerX,
          centerY,
          radius: heatmap.gridSize * 1.5,
          avgRisk,
          exposureCount,
          severity: this.calculateSeverity(avgRisk, exposureCount),
        });
      }
    }

    return this.deduplicateHotspots(hotspots);
  }

  async getHeatmap(warehouseId: string, zoneId?: string): Promise<SpatialHeatmap> {
    const redis = this.redis.getPublisher();
    const key = this.getHeatmapKey(warehouseId, zoneId);

    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    return await this.generateHeatmap(warehouseId, this.DEFAULT_GRID_SIZE, zoneId);
  }

  async precomputeHeatmaps(warehouseId: string): Promise<void> {
    this.logger.log(`Precomputing heatmaps for warehouse ${warehouseId}`);

    await this.generateHeatmap(warehouseId);

    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      select: { id: true },
    });

    for (const zone of zones) {
      await this.generateHeatmap(warehouseId, this.DEFAULT_GRID_SIZE, zone.id);
    }

    this.logger.log(`Completed heatmap precomputation for warehouse ${warehouseId}`);
  }

  private spatialBinning(
    coordinates: Array<{ x: number; y: number; risk: number }>,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    gridSize: number,
  ): HeatmapCell[] {
    const cellMap = new Map<string, { risks: number[]; count: number }>();

    for (const coord of coordinates) {
      const cellX = Math.floor((coord.x - bounds.minX) / gridSize) * gridSize + bounds.minX;
      const cellY = Math.floor((coord.y - bounds.minY) / gridSize) * gridSize + bounds.minY;
      const key = `${cellX},${cellY}`;

      if (!cellMap.has(key)) {
        cellMap.set(key, { risks: [], count: 0 });
      }

      const cell = cellMap.get(key)!;
      cell.risks.push(coord.risk);
      cell.count++;
    }

    const cells: HeatmapCell[] = [];
    for (const [key, data] of cellMap.entries()) {
      const [x, y] = key.split(',').map(Number);
      const avgRisk = data.risks.reduce((sum, r) => sum + r, 0) / data.risks.length;
      const maxRisk = Math.max(...data.risks);
      const riskDensity = avgRisk * Math.log(data.count + 1);

      cells.push({
        x,
        y,
        riskDensity,
        exposureCount: data.count,
        avgRisk,
        maxRisk,
      });
    }

    return cells.sort((a, b) => b.riskDensity - a.riskDensity);
  }

  private calculateBounds(coordinates: Array<{ x: number; y: number }>): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (coordinates.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    const xs = coordinates.map((c) => c.x);
    const ys = coordinates.map((c) => c.y);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  private findNeighboringCells(
    cell: HeatmapCell,
    allCells: HeatmapCell[],
    gridSize: number,
  ): HeatmapCell[] {
    return allCells.filter((c) => {
      if (c === cell) return false;
      const dx = Math.abs(c.x - cell.x);
      const dy = Math.abs(c.y - cell.y);
      return dx <= gridSize && dy <= gridSize;
    });
  }

  private calculateSeverity(
    avgRisk: number,
    exposureCount: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const score = avgRisk * Math.log(exposureCount + 1);

    if (score >= 3) return 'critical';
    if (score >= 2) return 'high';
    if (score >= 1) return 'medium';
    return 'low';
  }

  private deduplicateHotspots(hotspots: HotspotZone[]): HotspotZone[] {
    const deduplicated: HotspotZone[] = [];

    for (const hotspot of hotspots) {
      const isDuplicate = deduplicated.some((existing) => {
        const distance = Math.sqrt(
          Math.pow(existing.centerX - hotspot.centerX, 2) +
            Math.pow(existing.centerY - hotspot.centerY, 2),
        );
        return distance < hotspot.radius;
      });

      if (!isDuplicate) {
        deduplicated.push(hotspot);
      }
    }

    return deduplicated.sort((a, b) => b.avgRisk - a.avgRisk);
  }

  private async cacheHeatmap(heatmap: SpatialHeatmap): Promise<void> {
    const redis = this.redis.getPublisher();
    if (!redis) return;

    const key = this.getHeatmapKey(heatmap.warehouseId, heatmap.zoneId);
    await redis.setex(key, this.HEATMAP_TTL, JSON.stringify(heatmap));
  }

  private getHeatmapKey(warehouseId: string, zoneId?: string): string {
    return `heatmap:${warehouseId}:${zoneId || 'all'}`;
  }

  private getEmptyHeatmap(warehouseId: string, gridSize: number, zoneId?: string): SpatialHeatmap {
    return {
      warehouseId,
      zoneId,
      gridSize,
      cells: [],
      generatedAt: new Date(),
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    };
  }
}
