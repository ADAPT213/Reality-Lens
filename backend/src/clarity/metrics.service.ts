import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface ClarityMetrics {
  clarityScore?: number;
  overloadRisk?: number;
  ergonomicRisk?: number;
  stabilityIndex?: number;
}

@Injectable()
export class ClarityMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserMetrics(userId: string) {
    try {
      const last = await this.prisma.clarityMetric.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return (
        last ?? {
          userId,
          clarityScore: null,
          overloadRisk: null,
          ergonomicRisk: null,
          stabilityIndex: null,
        }
      );
    } catch {
      return {
        userId,
        clarityScore: null,
        overloadRisk: null,
        ergonomicRisk: null,
        stabilityIndex: null,
      };
    }
  }

  async updateUserClarity(userId: string, metrics: ClarityMetrics) {
    try {
      return await this.prisma.clarityMetric.create({
        data: {
          userId,
          clarityScore: metrics.clarityScore ?? null,
          overloadRisk: metrics.overloadRisk ?? null,
          ergonomicRisk: metrics.ergonomicRisk ?? null,
          stabilityIndex: metrics.stabilityIndex ?? null,
          snapshot: metrics as any,
        },
      });
    } catch {
      return null as any;
    }
  }

  async updateUserOverload(userId: string, overloadRisk: number) {
    return this.updateUserClarity(userId, { overloadRisk });
  }

  async getScopeMetrics(scope: 'warehouse' | 'zone', scopeId: string) {
    // Try to compute fresh; if helper not available, return last snapshot
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MachineMathService } = require('./machine-math.service');
      const math = new MachineMathService(this.prisma);
      return await math.updateScopeMetrics(scope, scopeId);
    } catch {
      const last = await this.prisma.clarityMetric.findFirst({
        where: { scope, scopeId },
        orderBy: { createdAt: 'desc' },
      });
      return (
        last ?? {
          scope,
          scopeId,
          clarityScore: null,
          overloadRisk: null,
          ergonomicRisk: null,
          stabilityIndex: null,
        }
      );
    }
  }
}
