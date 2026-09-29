// =============================================================================
// services/notifications/alert-service.ts
// Alert Notification Service for Slack, LINE, Webhook & Email Triggers
// Dispatched when synchronization retries exceed maximum threshold limits
// =============================================================================

import { markAlertSent } from '@/services/database/dlq';

export interface AlertPayload {
  errorCode: string;
  errorMessage: string;
  source: string;
  retryAttempts: number;
  maxAttempts: number;
  requestUrl?: string;
  requestParameters?: Record<string, unknown>;
  dlqId?: string;
  occurredAt?: Date;
}

export interface AlertDispatchResult {
  dispatched: boolean;
  channel: 'slack' | 'line' | 'generic_webhook' | 'console_dry_run';
  message: string;
  timestamp: string;
}

export interface AlertServiceOptions {
  webhookUrl?: string;
  lineNotifyToken?: string;
  fetchImpl?: typeof fetch;
}

export class AlertService {
  private readonly webhookUrl?: string;
  private readonly lineNotifyToken?: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: AlertServiceOptions = {}) {
    this.webhookUrl =
      options.webhookUrl ||
      process.env.ALERT_WEBHOOK_URL ||
      process.env.SLACK_WEBHOOK_URL;
    this.lineNotifyToken =
      options.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  /**
   * Send an alert notification when synchronization retries exceed maximum threshold limits.
   */
  public async sendRetryExceededAlert(payload: AlertPayload): Promise<AlertDispatchResult> {
    const timestamp = (payload.occurredAt || new Date()).toISOString();
    const alertTitle = `🚨 [TORBIDD Critical Alert] Synchronization Retries Exceeded`;
    const alertBody = [
      `*Error Code:* \`${payload.errorCode}\``,
      `*Source:* ${payload.source}`,
      `*Attempts Exhausted:* ${payload.retryAttempts} of ${payload.maxAttempts}`,
      `*Error Message:* ${payload.errorMessage}`,
      payload.requestUrl ? `*Target URL:* ${payload.requestUrl}` : null,
      payload.dlqId ? `*DLQ Reference ID:* \`${payload.dlqId}\`` : null,
      `*Timestamp:* ${timestamp}`,
    ]
      .filter(Boolean)
      .join('\n');

    // 1. Dispatch to Slack / Generic Webhook if configured
    if (this.webhookUrl) {
      try {
        const isSlack =
          this.webhookUrl.includes('slack.com') ||
          this.webhookUrl.includes('discord.com');
        const bodyContent = isSlack
          ? {
              text: alertTitle,
              blocks: [
                {
                  type: 'header',
                  text: { type: 'plain_text', text: alertTitle, emoji: true },
                },
                {
                  type: 'section',
                  text: { type: 'mrkdwn', text: alertBody },
                },
              ],
            }
          : {
              title: alertTitle,
              content: alertBody,
              payload,
              timestamp,
            };

        const response = await this.fetchImpl(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyContent),
        });

        if (!response.ok) {
          console.warn(`[AlertService] Webhook returned status ${response.status}`);
        }

        if (payload.dlqId) {
          await markAlertSent(payload.dlqId);
        }

        return {
          dispatched: true,
          channel: isSlack ? 'slack' : 'generic_webhook',
          message: 'Webhook alert dispatched successfully',
          timestamp,
        };
      } catch (netErr) {
        console.warn('[AlertService] Could not deliver webhook alert:', netErr);
      }
    }

    // 2. Dispatch to LINE Notify if configured
    if (this.lineNotifyToken) {
      try {
        const lineParams = new URLSearchParams();
        lineParams.append('message', `\n${alertTitle}\n${alertBody}`);

        const response = await this.fetchImpl('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${this.lineNotifyToken}`,
          },
          body: lineParams.toString(),
        });

        if (!response.ok) {
          console.warn(`[AlertService] LINE Notify returned status ${response.status}`);
        }

        if (payload.dlqId) {
          await markAlertSent(payload.dlqId);
        }

        return {
          dispatched: true,
          channel: 'line',
          message: 'LINE Notify alert dispatched successfully',
          timestamp,
        };
      } catch (lineErr) {
        console.warn('[AlertService] Could not deliver LINE alert:', lineErr);
      }
    }

    // 3. Fallback: Log structured alert banner for Administrator
    console.error(
      `\n=======================================================\n` +
        `${alertTitle}\n` +
        `-------------------------------------------------------\n` +
        alertBody +
        `\n=======================================================\n`,
    );

    if (payload.dlqId) {
      await markAlertSent(payload.dlqId);
    }

    return {
      dispatched: true,
      channel: 'console_dry_run',
      message: 'Alert logged to administrator console (no webhook URL configured)',
      timestamp,
    };
  }
}

export const alertService = new AlertService();
