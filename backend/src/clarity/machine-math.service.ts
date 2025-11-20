import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MachineMathService {
  constructor(private prisma: PrismaService) {}

  async updateScopeMetrics(scope: 'warehouse' | 'zone', scopeId: string) {
    const hours = 8;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const events = await this.prisma.clarityEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(scope === 'warehouse'
          ? { payload: { path: ['warehouseId'], equals: scopeId } as any }
          : { payload: { path: ['zoneId'], equals: scopeId } as any }),
      },
    });

    const totals = {
      uploads: 0,
      plans: 0,
      movesCompleted: 0,
      alerts: 0,
      copilotQuestions: 0,
      copilotRepeats: 0,
    };

    for (const ev of events) {
      switch (ev.type) {
        case 'warehouse_data_uploaded':
          totals.uploads += 1;
          break;
        case 'slotting_plan_generated':
          totals.plans += 1;
          break;
        case 'move_completed':
          totals.movesCompleted += 1;
          break;
        case 'heatmap_alert_triggered':
          totals.alerts += 1;
          break;
        case 'copilot_question':
          totals.copilotQuestions += 1;
          break;
        case 'copilot_repeat_question':
          totals.copilotRepeats += 1;
          break;
      }
    }

    const movesFactor = Math.min(totals.movesCompleted / (1 + totals.alerts), 5);
    const stabilityIndex = Math.round(Math.min(100, 40 + movesFactor * 12));

    const confusionPenalty = Math.min(totals.copilotRepeats + totals.alerts * 0.5, 10);
    const clarityScore = Math.round(Math.max(0, 95 - confusionPenalty * 5));

    const intensity = totals.uploads + totals.plans + totals.alerts;
    const overloadRisk = Math.round(Math.min(100, intensity * 7));

    const ergonomicRisk = await this.computeErgoRisk(scopeId, since);

    const metric = await this.prisma.clarityMetric.create({
      data: {
        userId: null,
        scope,
        scopeId,
        clarityScore,
        overloadRisk,
        stabilityIndex,
        ergonomicRisk,
      },
    });

    return metric;
  }

  private async computeErgoRisk(scopeId: string, since: Date): Promise<number> {
    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: { warehouseId: scopeId, createdAt: { gte: since } },
      select: { riskScore: true },
      take: 500,
    });
    if (!snapshots.length) return 50;
    const sum = snapshots.reduce((acc, s: any) => acc + Number(s.riskScore ?? 0), 0);
    return Math.round(sum / snapshots.length);
  }
}
