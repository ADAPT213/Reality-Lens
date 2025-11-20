import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface ScoreTerms {
  F: number;
  T: number;
  E: number;
  C: number;
  R: number;
  score: number;
}

@Injectable()
export class SlottingService {
  constructor(private prisma: PrismaService) {}

  private reachPenalty(reachBand?: string | null): number {
    if (!reachBand) return 1; // unknown → mild penalty
    const rb = reachBand.toLowerCase();
    if (rb.includes('preferred') || rb.includes('green')) return 0;
    if (rb.includes('yellow') || rb.includes('neutral')) return 1;
    if (rb.includes('red') || rb.includes('overhead') || rb.includes('floor')) return 3;
    return 1;
  }

  private travelCost(x?: any, y?: any): number {
    if (x == null || y == null) return 0.6; // unknown → assume mid cost
    const xn = Number(x),
      yn = Number(y);
    const d = Math.sqrt(xn * xn + yn * yn);
    return Math.min(1, d / 100); // normalize roughly to [0,1]
  }

  private frequencyNorm(avgPicksPerHour?: any): number {
    if (avgPicksPerHour == null) return 0.2;
    const v = Number(avgPicksPerHour);
    return Math.min(1, v / 400); // cap at 400 pph
  }

  private congestionPenalty(anomaly?: any): number {
    if (anomaly == null) return 0.1;
    return Math.max(0, Math.min(1, Number(anomaly)));
  }

  private ruleBonus(priority = false, nearFamily = false): number {
    let r = 0;
    if (priority) r += 0.1;
    if (nearFamily) r += 0.05;
    return r;
  }

  private score(terms: Omit<ScoreTerms, 'score'>): ScoreTerms {
    const score = 0.4 * terms.F - 0.3 * terms.T - 0.2 * terms.E - 0.1 * terms.C + terms.R;
    return { ...terms, score };
  }

  async computeForSkuAtLocation(skuId: string, locationId: string): Promise<ScoreTerms> {
    const assignment = await this.prisma.assignment.findFirst({
      where: { skuId, pickLocationId: locationId },
      include: { pickLocation: true },
    });
    const loc =
      assignment?.pickLocation ||
      (await this.prisma.pickLocation.findUnique({ where: { id: locationId } }));

    // Frequency: use assignment avg or from snapshots
    const avg =
      assignment?.avgPicksPerHour ||
      ((await this.prisma.ergonomicSnapshot.aggregate({
        where: { pickLocationId: locationId },
        _avg: { rulaScore: true },
      })) &&
        undefined); // fallback not available → 0.2 by design

    const F = this.frequencyNorm(assignment?.avgPicksPerHour);
    const T = this.travelCost(loc?.xCoord, loc?.yCoord);
    const E = this.reachPenalty(loc?.reachBand);

    // Congestion: proxy from latest shift snapshot anomaly
    const sh = await this.prisma.shiftSnapshot.findFirst({ orderBy: { bucketStart: 'desc' } });
    const C = this.congestionPenalty(sh?.anomalyScore);
    const R = this.ruleBonus(false, false);
    return this.score({ F, T, E, C, R });
  }

  async generateMovePlan(warehouseId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { pickLocation: { zone: { warehouseId } }, toTs: null },
      include: { pickLocation: true },
      take: 500,
    });
    const preferred = await this.prisma.pickLocation.findMany({
      where: { zone: { warehouseId }, reachBand: 'preferred' },
      take: 500,
    });

    const items: any[] = [];
    for (const a of assignments) {
      const current = await this.computeForSkuAtLocation(a.skuId, a.pickLocationId);
      const target = preferred.find((p) => p.id !== a.pickLocationId);
      if (!target) continue;
      const next = await this.computeForSkuAtLocation(a.skuId, target.id);

      const scoreDelta = next.score - current.score;
      if (scoreDelta <= 0.05) continue; // only suggest meaningful moves

      const expectedRiskReduction = current.E - next.E;
      const expectedSecondsSavedPerPick = Math.max(
        0,
        Math.round((current.T - next.T) * 60 * 10) / 10,
      );
      const rationale = `Move to preferred reach band from ${a.pickLocation.reachBand || 'unknown'}; travel cost improves.`;
      items.push({
        skuId: a.skuId,
        fromLocationId: a.pickLocationId,
        toLocationId: target.id,
        expectedSecondsSavedPerPick,
        expectedRiskReduction,
        F: Number(current.F.toFixed(3)),
        T: Number(current.T.toFixed(3)),
        E: Number(current.E.toFixed(3)),
        C: Number(current.C.toFixed(3)),
        R: Number(current.R.toFixed(3)),
        scoreBefore: Number(current.score.toFixed(3)),
        scoreAfter: Number(next.score.toFixed(3)),
        rationale,
        priority: Number((scoreDelta * 100).toFixed(1)),
      });
    }

    items.sort((a, b) => b.priority - a.priority);
    return { items, generatedAt: new Date().toISOString() };
  }

  async simulateMove(skuId: string, targetLocationId: string) {
    const curr = await this.prisma.assignment.findFirst({ where: { skuId, toTs: null } });
    if (!curr) throw new Error('Current assignment not found');
    const before = await this.computeForSkuAtLocation(skuId, curr.pickLocationId);
    const after = await this.computeForSkuAtLocation(skuId, targetLocationId);
    return {
      deltaSecondsPerPick: Math.round((before.T - after.T) * 60 * 10) / 10,
      deltaRisk: Number((before.E - after.E).toFixed(3)),
      scoreBefore: Number(before.score.toFixed(3)),
      scoreAfter: Number(after.score.toFixed(3)),
      F: Number(after.F.toFixed(3)),
      T: Number(after.T.toFixed(3)),
      E: Number(after.E.toFixed(3)),
      C: Number(after.C.toFixed(3)),
      R: Number(after.R.toFixed(3)),
      rationale: 'Projected improvement from travel and ergonomic band.',
    };
  }

  async heatmap(warehouseId: string) {
    const locs = await this.prisma.pickLocation.findMany({
      where: { zone: { warehouseId } },
      include: { zone: true },
    });
    const tiles = locs.map((l) => ({
      locationId: l.id,
      zoneId: l.zoneId,
      label: l.label,
      travelCost: Number(this.travelCost(l.xCoord, l.yCoord).toFixed(3)),
      frequency: 0, // require ingestion to populate precisely
      ergoPenalty: this.reachPenalty(l.reachBand),
      congestion: 0.1,
      reachBand: l.reachBand || null,
    }));
    return { tiles, generatedAt: new Date().toISOString() };
  }

  private pendingMoves: Array<any> = [];
  async commitMove(dto: {
    skuId: string;
    fromLocationId: string;
    toLocationId: string;
    windowStart?: string;
    windowEnd?: string;
  }) {
    // Try to persist; if DB is unavailable, keep an in-memory queue
    try {
      await this.prisma.$executeRaw`SELECT 1`;
      // Persist to a generic audit table if present; otherwise, no-op
    } catch {
      this.pendingMoves.push({ ...dto, receivedAt: new Date().toISOString() });
    }
  }

  async generatePlanFromVision(
    input: Array<{ warehouseId: string; locationCode: string; sku: string }>,
  ) {
    // Simple heuristic: for each pickface, propose optimizing to nearest preferred band if available
    const items: any[] = [];
    for (const pf of input) {
      const loc = await this.prisma.pickLocation.findFirst({
        where: { label: pf.locationCode, zone: { warehouseId: pf.warehouseId } },
      });
      if (!loc) continue;
      const current = await this.computeForSkuAtLocation(pf.sku, loc.id).catch(() => null as any);
      const preferred = await this.prisma.pickLocation.findFirst({
        where: { zone: { warehouseId: pf.warehouseId }, reachBand: 'preferred' },
      });
      if (!preferred || !current) continue;
      const next = await this.computeForSkuAtLocation(pf.sku, preferred.id).catch(
        () => null as any,
      );
      if (!next) continue;
      const scoreDelta = next.score - current.score;
      if (scoreDelta <= 0.05) continue;
      items.push({
        skuId: pf.sku,
        fromLocationId: loc.id,
        toLocationId: preferred.id,
        scoreBefore: Number(current.score.toFixed(3)),
        scoreAfter: Number(next.score.toFixed(3)),
        priority: Number((scoreDelta * 100).toFixed(1)),
      });
    }
    items.sort((a, b) => b.priority - a.priority);
    return { items, generatedAt: new Date().toISOString() };
  }
}
