import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RuleEngineService } from './rule-engine.service';
import { DeliveryService } from './delivery.service';
import { SimulatorService } from './simulator.service';
import { Alert, AlertRule, AlertState } from './schemas/rule.schema';
import { CreateRuleDto, GetAlertsQueryDto } from './dto/alerts.dto';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private rules: AlertRule[] = [];
  private alerts = new Map<string, Alert>();

  constructor(
    private prisma: PrismaService,
    private ruleEngine: RuleEngineService,
    private delivery: DeliveryService,
    private simulator: SimulatorService,
  ) {
    this.loadRules();
  }

  private async loadRules(): Promise<void> {
    this.rules = [
      {
        id: 'rule-high-risk-zone',
        name: 'High Risk Zone Alert',
        description: 'Alert when zone has >10 red locations for 5+ minutes',
        enabled: true,
        priority: 'high' as any,
        conditions: [
          {
            field: 'metrics.redLocations',
            operator: '>' as any,
            threshold: 10,
            durationMinutes: 5,
          },
        ],
        cooldownMinutes: 30,
        rateLimit: {
          maxAlerts: 3,
          windowMinutes: 60,
        },
        channels: [
          {
            channel: 'ui' as any,
            enabled: true,
          },
          {
            channel: 'slack' as any,
            enabled: !!process.env.SLACK_BOT_TOKEN,
            config: {
              slackChannel: '#smartpick-alerts',
              retries: 3,
            },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule-critical-risk',
        name: 'Critical Risk Level',
        description: 'Alert when average risk exceeds 8.0',
        enabled: true,
        priority: 'critical' as any,
        conditions: [
          {
            field: 'metrics.avgRisk',
            operator: '>' as any,
            threshold: 8.0,
            durationMinutes: 2,
          },
        ],
        hysteresis: {
          onThreshold: 8.0,
          offThreshold: 6.0,
        },
        cooldownMinutes: 15,
        channels: [
          {
            channel: 'ui' as any,
            enabled: true,
          },
          {
            channel: 'slack' as any,
            enabled: !!process.env.SLACK_BOT_TOKEN,
            config: {
              slackChannel: '#smartpick-critical',
              retries: 5,
            },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.logger.log(`Loaded ${this.rules.length} alert rules`);
  }

  async processEvent(event: Record<string, any>): Promise<void> {
    const triggeredAlerts = this.ruleEngine.evaluateRules(this.rules, event);

    for (const alert of triggeredAlerts) {
      this.alerts.set(alert.id, alert);

      const rule = this.rules.find((r) => r.id === alert.ruleId);
      if (rule) {
        await this.delivery.deliverAlert(alert, rule);
      }

      await this.persistAlert(alert);
    }
  }

  async getAlerts(query: GetAlertsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.state) where.state = query.state;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.shiftCode) where.shiftCode = query.shiftCode;
    if (query.priority) where.priority = query.priority;

    const alerts = Array.from(this.alerts.values())
      .filter((alert) => {
        if (query.state && alert.state !== query.state) return false;
        if (query.warehouseId && alert.warehouseId !== query.warehouseId) return false;
        if (query.zoneId && alert.zoneId !== query.zoneId) return false;
        if (query.shiftCode && alert.shiftCode !== query.shiftCode) return false;
        if (query.priority && alert.priority !== query.priority) return false;
        return true;
      })
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(skip, skip + limit);

    return {
      data: alerts,
      total: this.alerts.size,
      page,
      limit,
      totalPages: Math.ceil(this.alerts.size / limit),
    };
  }

  async acknowledgeAlert(id: string, userId?: string): Promise<Alert> {
    const alert = this.alerts.get(id);
    if (!alert) throw new NotFoundException('Alert not found');

    alert.state = AlertState.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    alert.updatedAt = new Date();

    await this.updatePersistedAlert(alert);
    return alert;
  }

  async snoozeAlert(id: string, minutes: number): Promise<Alert> {
    const alert = this.alerts.get(id);
    if (!alert) throw new NotFoundException('Alert not found');

    alert.state = AlertState.SNOOZED;
    alert.snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    alert.updatedAt = new Date();

    await this.updatePersistedAlert(alert);
    return alert;
  }

  async resolveAlert(id: string): Promise<Alert> {
    const alert = this.alerts.get(id);
    if (!alert) throw new NotFoundException('Alert not found');

    alert.state = AlertState.RESOLVED;
    alert.resolvedAt = new Date();
    alert.updatedAt = new Date();

    await this.updatePersistedAlert(alert);
    return alert;
  }

  async getRules(): Promise<AlertRule[]> {
    return this.rules;
  }

  async getRule(id: string): Promise<AlertRule> {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async createRule(dto: CreateRuleDto): Promise<AlertRule> {
    const rule: AlertRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.push(rule);
    this.logger.log(`Created rule ${rule.id}: ${rule.name}`);

    return rule;
  }

  async updateRule(id: string, dto: CreateRuleDto): Promise<AlertRule> {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) throw new NotFoundException('Rule not found');

    this.rules[index] = {
      ...this.rules[index],
      ...dto,
      updatedAt: new Date(),
    };

    this.logger.log(`Updated rule ${id}`);
    return this.rules[index];
  }

  async toggleRule(id: string, enabled: boolean): Promise<AlertRule> {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule) throw new NotFoundException('Rule not found');

    rule.enabled = enabled;
    rule.updatedAt = new Date();

    this.logger.log(`Toggled rule ${id} to ${enabled ? 'enabled' : 'disabled'}`);
    return rule;
  }

  async simulate(minutes: number, ruleId?: string): Promise<any> {
    return this.simulator.simulate(this.rules, minutes, ruleId);
  }

  private async persistAlert(alert: Alert): Promise<void> {
    try {
      await this.prisma.alert.create({
        data: {
          id: alert.id,
          warehouseId: alert.warehouseId,
          zoneId: alert.zoneId,
          shiftCode: alert.shiftCode,
          severity: alert.priority,
          title: alert.title,
          message: alert.message,
          triggeredAt: alert.triggeredAt,
          createdByRule: alert.ruleId,
          acknowledgedBy: alert.acknowledgedBy,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to persist alert ${alert.id}: ${error?.message}`);
    }
  }

  private async updatePersistedAlert(alert: Alert): Promise<void> {
    try {
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: {
          acknowledgedBy: alert.acknowledgedBy,
          resolvedAt: alert.resolvedAt,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to update alert ${alert.id}: ${error?.message}`);
    }
  }
}
