import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface TravelCostMetrics {
  distanceFromDock: number;
  distanceFromMainPath: number;
  averageDistanceToRelatedSkus: number;
  normalizedScore: number;
}

@Injectable()
export class TravelCostCalculator {
  constructor(private prisma: PrismaService) {}

  async calculateTravelCost(locationId: string, warehouseId: string): Promise<TravelCostMetrics> {
    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: {
        xCoord: true,
        yCoord: true,
        zone: {
          select: {
            warehouseId: true,
          },
        },
      },
    });

    if (!location || !location.xCoord || !location.yCoord) {
      return {
        distanceFromDock: 0,
        distanceFromMainPath: 0,
        averageDistanceToRelatedSkus: 0,
        normalizedScore: 0,
      };
    }

    const dockDistance = await this.calculateDistanceFromDock(
      Number(location.xCoord),
      Number(location.yCoord),
      warehouseId,
    );

    const pathDistance = await this.calculateDistanceFromMainPath(
      Number(location.xCoord),
      Number(location.yCoord),
      warehouseId,
    );

    const relatedDistance = await this.calculateAverageDistanceToRelatedSkus(
      locationId,
      Number(location.xCoord),
      Number(location.yCoord),
    );

    const totalDistance = dockDistance + pathDistance + relatedDistance;
    const normalizedScore = this.normalize(totalDistance);

    return {
      distanceFromDock: dockDistance,
      distanceFromMainPath: pathDistance,
      averageDistanceToRelatedSkus: relatedDistance,
      normalizedScore,
    };
  }

  private async calculateDistanceFromDock(
    x: number,
    y: number,
    warehouseId: string,
  ): Promise<number> {
    const dockX = 0;
    const dockY = 0;

    return Math.sqrt(Math.pow(x - dockX, 2) + Math.pow(y - dockY, 2));
  }

  private async calculateDistanceFromMainPath(
    x: number,
    y: number,
    warehouseId: string,
  ): Promise<number> {
    const mainPathY = 0;
    return Math.abs(y - mainPathY);
  }

  private async calculateAverageDistanceToRelatedSkus(
    locationId: string,
    x: number,
    y: number,
  ): Promise<number> {
    const nearbyLocations = await this.prisma.pickLocation.findMany({
      where: {
        zone: {
          id: {
            in: await this.getRelatedZones(locationId),
          },
        },
        id: { not: locationId },
      },
      select: {
        xCoord: true,
        yCoord: true,
      },
      take: 10,
    });

    if (nearbyLocations.length === 0) return 0;

    const distances = nearbyLocations.map((loc) => {
      if (!loc.xCoord || !loc.yCoord) return 0;
      return Math.sqrt(Math.pow(Number(loc.xCoord) - x, 2) + Math.pow(Number(loc.yCoord) - y, 2));
    });

    return distances.reduce((sum, d) => sum + d, 0) / distances.length;
  }

  private async getRelatedZones(locationId: string): Promise<string[]> {
    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { zoneId: true },
    });

    return location ? [location.zoneId] : [];
  }

  private normalize(distance: number, maxExpected = 100): number {
    return Math.min(distance / maxExpected, 1.0);
  }
}
