import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import { Alert, AlertChannel, AlertRule } from './schemas/rule.schema';
import { WebsocketGateway } from '../websocket/websocket.gateway';

interface RateLimitState {
  count: number;
  windowStart: number;
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private slackClient?: any;
  private rateLimits = new Map<string, RateLimitState>();

  constructor(private websocketGateway: WebsocketGateway) {
    if (process.env.SLACK_BOT_TOKEN) {
      import('@slack/web-api')
        .then(({ WebClient }) => {
          this.slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
        })
        .catch(() => this.logger.warn('Slack SDK not available'));
    }
  }

  async deliverAlert(alert: Alert, rule: AlertRule): Promise<void> {
    const enabledChannels = rule.channels.filter((c) => c.enabled);

    for (const channelConfig of enabledChannels) {
      if (this.isRateLimited(channelConfig.channel, rule)) {
        this.logger.warn(`Rate limited on ${channelConfig.channel} for rule ${rule.id}`);
        continue;
      }

      try {
        await this.deliverToChannel(alert, channelConfig.channel, channelConfig.config);

        alert.notificationsSent.push({
          channel: channelConfig.channel,
          sentAt: new Date(),
          success: true,
        });

        this.incrementRateLimit(channelConfig.channel, rule);
      } catch (error: any) {
        this.logger.error(`Failed to deliver alert to ${channelConfig.channel}: ${error?.message}`);

        alert.notificationsSent.push({
          channel: channelConfig.channel,
          sentAt: new Date(),
          success: false,
          error: error?.message,
        });
      }
    }
  }

  private async deliverToChannel(alert: Alert, channel: AlertChannel, config?: any): Promise<void> {
    switch (channel) {
      case AlertChannel.WEBHOOK:
        await this.sendWebhook(alert, config);
        break;
      case AlertChannel.SLACK:
        await this.sendSlack(alert, config);
        break;
      case AlertChannel.EMAIL:
        await this.sendEmail(alert, config);
        break;
      case AlertChannel.UI:
        await this.sendUI(alert);
        break;
    }
  }

  private async sendWebhook(alert: Alert, config: any): Promise<void> {
    const url = config?.webhookUrl;
    if (!url) throw new Error('Webhook URL not configured');

    const retries = config?.retries || 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: alert.id,
            priority: alert.priority,
            title: alert.title,
            message: alert.message,
            warehouseId: alert.warehouseId,
            zoneId: alert.zoneId,
            shiftCode: alert.shiftCode,
            triggeredAt: alert.triggeredAt,
            metadata: alert.metadata,
          }),
          timeout: 10000,
        } as any);

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}`);
        }

        this.logger.log(`Webhook sent for alert ${alert.id} to ${url}`);
        return;
      } catch (error: any) {
        lastError = error as Error;
        this.logger.warn(`Webhook attempt ${attempt + 1}/${retries} failed: ${error?.message}`);

        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('Webhook delivery failed');
  }

  private async sendSlack(alert: Alert, config: any): Promise<void> {
    if (!this.slackClient) {
      throw new Error('Slack client not configured');
    }

    const channel = config?.slackChannel || '#alerts';
    const color = this.getPriorityColor(alert.priority);

    await this.slackClient.chat.postMessage({
      channel,
      text: alert.title,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Priority',
              value: alert.priority.toUpperCase(),
              short: true,
            },
            {
              title: 'Warehouse',
              value: alert.warehouseId,
              short: true,
            },
            ...(alert.zoneId
              ? [
                  {
                    title: 'Zone',
                    value: alert.zoneId,
                    short: true,
                  },
                ]
              : []),
            ...(alert.shiftCode
              ? [
                  {
                    title: 'Shift',
                    value: alert.shiftCode,
                    short: true,
                  },
                ]
              : []),
          ],
          footer: 'SmartPick Alerts',
          ts: Math.floor(alert.triggeredAt.getTime() / 1000).toString(),
        },
      ],
    });

    this.logger.log(`Slack message sent for alert ${alert.id} to ${channel}`);
  }

  private async sendEmail(alert: Alert, config: any): Promise<void> {
    this.logger.warn('Email delivery not implemented');
  }

  private async sendUI(alert: Alert): Promise<void> {
    this.websocketGateway.server.emit('ALERT', {
      id: alert.id,
      priority: alert.priority,
      state: alert.state,
      title: alert.title,
      message: alert.message,
      warehouseId: alert.warehouseId,
      zoneId: alert.zoneId,
      shiftCode: alert.shiftCode,
      triggeredAt: alert.triggeredAt,
      metadata: alert.metadata,
    });

    this.logger.log(`UI alert broadcast for ${alert.id}`);
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return '#FF0000';
      case 'high':
        return '#FF6600';
      case 'medium':
        return '#FFCC00';
      case 'low':
        return '#00CC00';
      default:
        return '#CCCCCC';
    }
  }

  private isRateLimited(channel: AlertChannel, rule: AlertRule): boolean {
    if (!rule.rateLimit) return false;

    const key = `${channel}-${rule.id}`;
    const state = this.rateLimits.get(key);

    if (!state) return false;

    const windowMs = rule.rateLimit.windowMinutes * 60 * 1000;
    const elapsed = Date.now() - state.windowStart;

    if (elapsed > windowMs) {
      this.rateLimits.delete(key);
      return false;
    }

    return state.count >= rule.rateLimit.maxAlerts;
  }

  private incrementRateLimit(channel: AlertChannel, rule: AlertRule): void {
    if (!rule.rateLimit) return;

    const key = `${channel}-${rule.id}`;
    const state = this.rateLimits.get(key);

    if (!state) {
      this.rateLimits.set(key, {
        count: 1,
        windowStart: Date.now(),
      });
    } else {
      state.count++;
    }
  }
}
