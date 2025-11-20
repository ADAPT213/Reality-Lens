import { Injectable, Logger } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';
import { AlertRule } from './schemas/rule.schema';

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);
  private eventHistory: Array<{ timestamp: Date; event: Record<string, any> }> = [];

  constructor(private ruleEngine: RuleEngineService) {
    setInterval(() => this.cleanOldEvents(), 60000);
  }

  recordEvent(event: Record<string, any>): void {
    this.eventHistory.push({
      timestamp: new Date(),
      event,
    });

    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-5000);
    }
  }

  async simulate(rules: AlertRule[], minutes: number, ruleId?: string): Promise<any> {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const recentEvents = this.eventHistory.filter((e) => e.timestamp.getTime() >= cutoff);

    if (recentEvents.length === 0) {
      return {
        minutes,
        eventsAnalyzed: 0,
        message: 'No events in the specified time window',
        alerts: [],
      };
    }

    const targetRules = ruleId ? rules.filter((r) => r.id === ruleId) : rules;

    const simulationResults = targetRules.map((rule) => {
      const alerts = [];

      for (const { event } of recentEvents) {
        const triggeredAlerts = this.ruleEngine.evaluateRules([rule], event);
        alerts.push(...triggeredAlerts);
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        alertCount: alerts.length,
        alerts: alerts.slice(0, 10),
      };
    });

    const totalAlerts = simulationResults.reduce((sum, r) => sum + r.alertCount, 0);

    this.logger.log(
      `Simulation: ${recentEvents.length} events, ${totalAlerts} alerts over ${minutes}min`,
    );

    return {
      minutes,
      eventsAnalyzed: recentEvents.length,
      totalAlerts,
      ruleResults: simulationResults,
    };
  }

  async simulateWithThreshold(
    rule: AlertRule,
    minutes: number,
    newThreshold: number,
  ): Promise<any> {
    const modifiedRule = { ...rule };
    if (modifiedRule.conditions.length > 0) {
      modifiedRule.conditions[0] = {
        ...modifiedRule.conditions[0],
        threshold: newThreshold,
      };
    }

    return this.simulate([modifiedRule], minutes, modifiedRule.id);
  }

  private cleanOldEvents(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const before = this.eventHistory.length;

    this.eventHistory = this.eventHistory.filter((e) => e.timestamp.getTime() >= cutoff);

    const removed = before - this.eventHistory.length;
    if (removed > 0) {
      this.logger.debug(`Cleaned ${removed} old events from history`);
    }
  }
}
