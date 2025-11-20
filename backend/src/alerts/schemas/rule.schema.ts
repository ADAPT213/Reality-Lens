export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertOperator {
  GT = '>',
  GTE = '>=',
  LT = '<',
  LTE = '<=',
  EQ = '==',
  NEQ = '!=',
}

export enum AlertChannel {
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  EMAIL = 'email',
  UI = 'ui',
}

export interface RuleCondition {
  field: string;
  operator: AlertOperator;
  threshold: number;
  durationMinutes?: number;
}

export interface ChannelConfig {
  channel: AlertChannel;
  enabled: boolean;
  config?: {
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
    retries?: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: AlertPriority;

  conditions: RuleCondition[];
  hysteresis?: {
    onThreshold: number;
    offThreshold: number;
  };

  cooldownMinutes?: number;
  rateLimit?: {
    maxAlerts: number;
    windowMinutes: number;
  };

  channels: ChannelConfig[];

  scope?: {
    warehouseIds?: string[];
    zoneIds?: string[];
    shiftCodes?: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface AlertFingerprint {
  ruleId: string;
  warehouseId: string;
  zoneId?: string;
  shiftCode?: string;
}

export enum AlertState {
  CREATED = 'created',
  ACKNOWLEDGED = 'acknowledged',
  SNOOZED = 'snoozed',
  RESOLVED = 'resolved',
}

export interface Alert {
  id: string;
  fingerprint: string;
  ruleId: string;
  ruleName: string;
  priority: AlertPriority;
  state: AlertState;

  warehouseId: string;
  zoneId?: string;
  shiftCode?: string;

  title: string;
  message: string;
  metadata?: Record<string, any>;

  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  snoozedUntil?: Date;
  resolvedAt?: Date;

  notificationsSent: {
    channel: AlertChannel;
    sentAt: Date;
    success: boolean;
    error?: string;
  }[];

  createdAt: Date;
  updatedAt: Date;
}
