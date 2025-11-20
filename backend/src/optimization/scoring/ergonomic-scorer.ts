import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface ErgonomicMetrics {
  band: 'green' | 'yellow' | 'red';
  penalty: number;
  averageRulaScore: number;
  averageRebaScore: number;
  averageCompositeRisk: number;
  incidentCount: number;
  normalizedScore: number;
}

@Injectable()
export class ErgonomicScorer {
  private readonly BAND_PENALTIES = {
    green: 0.0,
    yellow: 0.5,
    red: 1.0,
  };

  constructor(private prisma: PrismaService) {}

  async calculateErgonomicScore(locationId: string, lookbackDays = 30): Promise<ErgonomicMetrics> {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: {
        reachBand: true,
        zHeightCm: true,
      },
    });

    const band = this.determineBand(location?.reachBand || null, Number(location?.zHeightCm || 0));

    const snapshots = await this.prisma.ergonomicSnapshot.findMany({
      where: {
        pickLocationId: locationId,
        eventTime: { gte: lookbackDate },
      },
      select: {
        rulaScore: true,
        rebaScore: true,
        compositeRisk: true,
        trafficLight: true,
      },
    });

    const avgRula = this.average(snapshots.map((s) => s.rulaScore ?? 0));
    const avgReba = this.average(snapshots.map((s) => s.rebaScore ?? 0));
    const avgCompositeRisk = this.average(
      snapshots.map((s) => (s.compositeRisk ? Number(s.compositeRisk) : 0)),
    );

    const incidentCount = snapshots.filter((s) => s.trafficLight === 'red').length;

    const penalty = this.BAND_PENALTIES[band];
    const normalizedScore = this.normalize(penalty, avgCompositeRisk, incidentCount);

    return {
      band,
      penalty,
      averageRulaScore: avgRula,
      averageRebaScore: avgReba,
      averageCompositeRisk: avgCompositeRisk,
      incidentCount,
      normalizedScore,
    };
  }

  private determineBand(reachBand: string | null, heightCm: number): 'green' | 'yellow' | 'red' {
    if (heightCm >= 50 && heightCm <= 150) return 'green';
    if (heightCm < 50 || (heightCm > 150 && heightCm <= 200)) return 'yellow';
    return 'red';
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private normalize(penalty: number, compositeRisk: number, incidents: number): number {
    const riskComponent = compositeRisk / 10;
    const incidentComponent = Math.min(incidents / 100, 1);
    return penalty * 0.5 + riskComponent * 0.3 + incidentComponent * 0.2;
  }

  async getLocationBand(locationId: string): Promise<'green' | 'yellow' | 'red'> {
    const location = await this.prisma.pickLocation.findUnique({
      where: { id: locationId },
      select: { reachBand: true, zHeightCm: true },
    });

    return this.determineBand(location?.reachBand || null, Number(location?.zHeightCm || 0));
  }
}
