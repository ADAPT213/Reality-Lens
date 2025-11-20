import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ClarityMetricsService } from './metrics.service';
import { PlaybooksService } from './playbooks.service';

@Injectable()
export class GuidanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ClarityMetricsService,
    private readonly playbooks: PlaybooksService,
  ) {}

  async requestGuidance(userId: string, context?: any) {
    const m = await this.metrics.getUserMetrics(userId);
    const code = context?.area === 'replen' ? 'replen_night_shift' : 'summary_exec_brief';
    const playbook = await this.playbooks.getByCode(code);
    const actions = [
      { action: 'review_top_moves', reason: 'Focus on highest ROI and safety first.' },
      { action: 'acknowledge_open_alerts', reason: 'Reduce uncertainty before the shift ramps.' },
    ];
    try {
      const saved = await this.prisma.clarityGuidance.create({
        data: {
          userId,
          playbookId: playbook?.id ?? null,
          actions: actions as any,
          rationale: 'Based on current metrics.',
        },
      });
      return { metrics: m, playbook, actions, id: saved.id };
    } catch {
      return { metrics: m, playbook, actions };
    }
  }
}
