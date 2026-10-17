import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import { createLogger } from '@heach/logger';

/** Sends an operational alert. Messages never carry personal or health data. */
export interface AlertPublisher {
  publish(subject: string, message: string): Promise<void>;
}

export const ALERT_PUBLISHER = Symbol('ALERT_PUBLISHER');

/** The on-call topic (D5: heach-credit-reminders). */
export class SnsAlertPublisher implements AlertPublisher {
  constructor(
    private readonly sns: Pick<SNSClient, 'send'>,
    private readonly topicArn: string,
  ) {}

  async publish(subject: string, message: string): Promise<void> {
    await this.sns.send(
      new PublishCommand({ TopicArn: this.topicArn, Subject: subject, Message: message }),
    );
  }
}

/** Local and test: the alert is a structured warning log. */
export class LogAlertPublisher implements AlertPublisher {
  private readonly logger = createLogger({ name: 'alerts' });

  publish(subject: string, message: string): Promise<void> {
    this.logger.warn({ alert: subject, detail: message }, 'Alert');
    return Promise.resolve();
  }
}
