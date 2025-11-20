import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface RuleAlignmentMetrics {
  clientPriorityBonus: number;
  familyAffinityBonus: number;
  laneAffinityBonus: number;
  totalBonus: number;
  appliedRules: string[];
}

interface ServiceRule {
  id: string;
  warehouseId: string;
  clientPriorities: any;
  skuFamilies: any;
  laneAffinities: any;
}

@Injectable()
export class RuleEngine {
  constructor(private prisma: PrismaService) {}

  async calculateRuleAlignment(
    skuId: string,
    locationId: string,
    warehouseId: string,
  ): Promise<RuleAlignmentMetrics> {
    const rules = await this.getServiceRules(warehouseId);

    const clientBonus = await this.evaluateClientPriority(skuId, locationId, rules);
    const familyBonus = await this.evaluateFamilyAffinity(skuId, locationId, rules);
    const laneBonus = await this.evaluateLaneAffinity(skuId, locationId, rules);

    const appliedRules: string[] = [];
    if (clientBonus > 0) appliedRules.push('client_priority');
    if (familyBonus > 0) appliedRules.push('family_affinity');
    if (laneBonus > 0) appliedRules.push('lane_affinity');

    return {
      clientPriorityBonus: clientBonus,
      familyAffinityBonus: familyBonus,
      laneAffinityBonus: laneBonus,
      totalBonus: clientBonus + familyBonus + laneBonus,
      appliedRules,
    };
  }

  private async getServiceRules(warehouseId: string): Promise<ServiceRule | null> {
    return null;
  }

  private async evaluateClientPriority(
    skuId: string,
    locationId: string,
    rules: ServiceRule | null,
  ): Promise<number> {
    if (!rules?.clientPriorities) return 0;

    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
    });

    if (!sku) return 0;

    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { zoneId: true },
    });

    if (!location) return 0;

    return 0.2;
  }

  private async evaluateFamilyAffinity(
    skuId: string,
    locationId: string,
    rules: ServiceRule | null,
  ): Promise<number> {
    if (!rules?.skuFamilies) return 0;

    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: {
        xCoord: true,
        yCoord: true,
        zoneId: true,
      },
    });

    if (!location?.xCoord || !location?.yCoord) return 0;

    const nearbySkus = await this.prisma.assignment.findMany({
      where: {
        pickLocation: {
          zoneId: location.zoneId,
        },
        toTs: null,
        skuId: { not: skuId },
      },
      select: {
        skuId: true,
      },
      take: 10,
    });

    if (nearbySkus.length > 5) {
      return 0.15;
    }

    return 0;
  }

  private async evaluateLaneAffinity(
    skuId: string,
    locationId: string,
    rules: ServiceRule | null,
  ): Promise<number> {
    if (!rules?.laneAffinities) return 0;

    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { zoneId: true },
    });

    if (!location) return 0;

    return 0.1;
  }

  async validateMove(
    skuId: string,
    fromLocationId: string,
    toLocationId: string,
    warehouseId: string,
  ): Promise<{ valid: boolean; violations: string[] }> {
    const violations: string[] = [];

    const toLocation = await this.prisma.pickLocation.findUnique({
      where: { id: toLocationId },
      include: {
        assignments: {
          where: { toTs: null },
        },
      },
    });

    if (toLocation?.assignments && toLocation.assignments.length > 0) {
      violations.push('Target location is already occupied');
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
