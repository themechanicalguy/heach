import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ALERT_PUBLISHER, type AlertPublisher } from '../security/alert-publisher.js';

export const ERROR_RATE_THRESHOLD = 0.05;
export const WINDOW_MINUTES = 5;
/** Below this many requests in the window, a few errors are not a trend. */
export const MIN_REQUESTS = 20;

interface Bucket {
  minute: number;
  total: number;
  errors: number;
}

/**
 * LM-07.1: when 5xx responses exceed 5 percent of requests over five minutes, one alert goes to
 * the on-call topic (D5); it re-arms only after the rate falls back below the threshold.
 */
@Injectable()
export class ErrorRateMonitor implements OnModuleDestroy {
  private buckets: Bucket[] = [];
  private alerting = false;
  private readonly timer: NodeJS.Timeout;

  constructor(
    @Inject(ALERT_PUBLISHER) private readonly alerts: AlertPublisher,
    private readonly now: () => number = Date.now,
  ) {
    this.timer = setInterval(() => void this.evaluate(), 60_000);
    this.timer.unref();
  }

  record(status: number): void {
    const minute = Math.floor(this.now() / 60_000);
    let bucket = this.buckets.at(-1);
    if (bucket?.minute !== minute) {
      bucket = { minute, total: 0, errors: 0 };
      this.buckets = [...this.buckets.filter((b) => b.minute > minute - WINDOW_MINUTES), bucket];
    }
    bucket.total += 1;
    bucket.errors += status >= 500 ? 1 : 0;
  }

  /** The error rate over the last five minutes, or undefined when there is too little traffic. */
  rate(): number | undefined {
    const since = Math.floor(this.now() / 60_000) - WINDOW_MINUTES;
    const recent = this.buckets.filter((b) => b.minute > since);
    const total = recent.reduce((sum, b) => sum + b.total, 0);
    return total < MIN_REQUESTS ? undefined : recent.reduce((sum, b) => sum + b.errors, 0) / total;
  }

  async evaluate(): Promise<void> {
    const rate = this.rate();
    const high = rate !== undefined && rate > ERROR_RATE_THRESHOLD;
    if (high && !this.alerting) {
      this.alerting = true;
      await this.alerts.publish(
        'HEACH: API error rate above 5 percent',
        `API 5xx rate ${(rate * 100).toFixed(1)} percent over the last ${String(WINDOW_MINUTES)} minutes.`,
      );
    } else if (!high) {
      this.alerting = false;
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
