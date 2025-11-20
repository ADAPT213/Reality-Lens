import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  Alert,
  AlertFingerprint,
  AlertOperator,
  AlertPriority,
  AlertRule,
  AlertState,
  RuleCondition,
} from './schemas/rule.schema';

interface RuleState {
  value: number;
  firstTriggeredAt?: Date;
  lastAlertSentAt?: Date;
  alertCount: number;
  hysteresisActive: boolean;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);
  private ruleStates = new Map<string, Map<string, RuleState>>();

  evaluateRules(rules: AlertRule[], event: Record<string, any>): Alert[] {
    const alerts: Alert[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!this.matchesScope(rule, event)) continue;

      const alert = this.evaluateRule(rule, event);
      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  private evaluateRule(rule: AlertRule, event: Record<string, any>): Alert | null {
    const fingerprint = this.generateFingerprint({
      ruleId: rule.id,
      warehouseId: event.warehouseId,
      zoneId: event.zoneId,
      shiftCode: event.shiftCode,
    });

    const allConditionsMet = rule.conditions.every((condition) =>
      this.evaluateCondition(condition, event, fingerprint, rule),
    );

    if (!allConditionsMet) {
      this.clearRuleState(rule.id, fingerprint);
      return null;
    }

    if (this.isInCooldown(rule, fingerprint)) {
      this.logger.debug(`Rule ${rule.name} in cooldown for ${fingerprint}`);
      return null;
    }

    if (this.exceedsRateLimit(rule, fingerprint)) {
      this.logger.warn(`Rule ${rule.name} exceeded rate limit for ${fingerprint}`);
      return null;
    }

    const alert = this.createAlert(rule, event, fingerprint);
    this.updateAlertState(rule, fingerprint);

    return alert;
  }

  private evaluateCondition(
    condition: RuleCondition,
    event: Record<string, any>,
    fingerprint: string,
    rule: AlertRule,
  ): boolean {
    const value = this.extractValue(condition.field, event);
    if (value === undefined || value === null) return false;

    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numericValue)) return false;

    const meetsThreshold = this.compareValues(
      numericValue,
      condition.operator,
      condition.threshold,
    );

    if (rule.hysteresis && !meetsThreshold) {
      const state = this.getRuleState(rule.id, fingerprint);
      if (state.hysteresisActive) {
        const offThreshold = rule.hysteresis.offThreshold;
        const meetsOff = this.compareValues(numericValue, condition.operator, offThreshold);
        if (!meetsOff) {
          state.hysteresisActive = false;
          return false;
        }
        return true;
      }
    }

    if (meetsThreshold && rule.hysteresis) {
      const state = this.getRuleState(rule.id, fingerprint);
      state.hysteresisActive = true;
    }

    if (condition.durationMinutes) {
      return this.checkDuration(
        rule.id,
        fingerprint,
        numericValue,
        meetsThreshold,
        condition.durationMinutes,
      );
    }

    return meetsThreshold;
  }

  private checkDuration(
    ruleId: string,
    fingerprint: string,
    value: number,
    meetsThreshold: boolean,
    durationMinutes: number,
  ): boolean {
    const state = this.getRuleState(ruleId, fingerprint);
    state.value = value;

    if (meetsThreshold) {
      if (!state.firstTriggeredAt) {
        state.firstTriggeredAt = new Date();
      }

      const elapsed = Date.now() - state.firstTriggeredAt.getTime();
      const requiredMs = durationMinutes * 60 * 1000;

      return elapsed >= requiredMs;
    } else {
      state.firstTriggeredAt = undefined;
      return false;
    }
  }

  private compareValues(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case AlertOperator.GT:
        return value > threshold;
      case AlertOperator.GTE:
        return value >= threshold;
      case AlertOperator.LT:
        return value < threshold;
      case AlertOperator.LTE:
        return value <= threshold;
      case AlertOperator.EQ:
        return value === threshold;
      case AlertOperator.NEQ:
        return value !== threshold;
      default:
        return false;
    }
  }

  private extractValue(field: string, event: Record<string, any>): any {
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    return value;
  }

  private matchesScope(rule: AlertRule, event: Record<string, any>): boolean {
    if (!rule.scope) return true;

    const { warehouseIds, zoneIds, shiftCodes } = rule.scope;

    if (warehouseIds?.length && !warehouseIds.includes(event.warehouseId)) {
      return false;
    }

    if (zoneIds?.length && !zoneIds.includes(event.zoneId)) {
      return false;
    }

    if (shiftCodes?.length && !shiftCodes.includes(event.shiftCode)) {
      return false;
    }

    return true;
  }

  private generateFingerprint(fp: AlertFingerprint): string {
    const data = JSON.stringify({
      ruleId: fp.ruleId,
      warehouseId: fp.warehouseId,
      zoneId: fp.zoneId || '',
      shiftCode: fp.shiftCode || '',
    });
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private getRuleState(ruleId: string, fingerprint: string): RuleState {
    if (!this.ruleStates.has(ruleId)) {
      this.ruleStates.set(ruleId, new Map());
    }

    const ruleMap = this.ruleStates.get(ruleId)!;
    if (!ruleMap.has(fingerprint)) {
      ruleMap.set(fingerprint, {
        value: 0,
        alertCount: 0,
        hysteresisActive: false,
      });
    }

    return ruleMap.get(fingerprint)!;
  }

  private clearRuleState(ruleId: string, fingerprint: string): void {
    const ruleMap = this.ruleStates.get(ruleId);
    if (ruleMap) {
      ruleMap.delete(fingerprint);
    }
  }

  private isInCooldown(rule: AlertRule, fingerprint: string): boolean {
    if (!rule.cooldownMinutes) return false;

    const state = this.getRuleState(rule.id, fingerprint);
    if (!state.lastAlertSentAt) return false;

    const elapsed = Date.now() - state.lastAlertSentAt.getTime();
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;

    return elapsed < cooldownMs;
  }

  private exceedsRateLimit(rule: AlertRule, fingerprint: string): boolean {
    if (!rule.rateLimit) return false;

    const state = this.getRuleState(rule.id, fingerprint);
    const windowMs = rule.rateLimit.windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    if (!state.lastAlertSentAt || state.lastAlertSentAt.getTime() < cutoff) {
      state.alertCount = 0;
      return false;
    }

    return state.alertCount >= rule.rateLimit.maxAlerts;
  }

  private updateAlertState(rule: AlertRule, fingerprint: string): void {
    const state = this.getRuleState(rule.id, fingerprint);
    state.lastAlertSentAt = new Date();
    state.alertCount++;
  }

  private createAlert(rule: AlertRule, event: Record<string, any>, fingerprint: string): Alert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      fingerprint,
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      state: AlertState.CREATED,
      warehouseId: event.warehouseId,
      zoneId: event.zoneId,
      shiftCode: event.shiftCode,
      title: this.formatMessage(rule.name, event),
      message: this.formatMessage(rule.description || rule.name, event),
      metadata: { ...event },
      triggeredAt: new Date(),
      notificationsSent: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private formatMessage(template: string, event: Record<string, any>): string {
    return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, field) => {
      const value = this.extractValue(field, event);
      return value !== undefined ? String(value) : `{${field}}`;
    });
  }
}
