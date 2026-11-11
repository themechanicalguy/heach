import { createHmac, randomUUID } from 'node:crypto';
import type { IdentityVerifier } from './identity.port.js';
import type { ObjectStore } from './object-store.port.js';
import type { GatewayEvent, PaymentGateway } from './payments.port.js';
import type { VirusScanner } from './scanner.port.js';
import type { SmsMessage, SmsSender } from './sms.port.js';
import type { VideoRooms } from './video.port.js';

/**
 * Test doubles for the third parties (TS-06.1). They record calls in memory and never touch a
 * network. Only adapters.module.ts and tests may import this file (lint boundary).
 */
export class FakeSmsSender implements SmsSender {
  readonly sent: SmsMessage[] = [];
  /** Set by a test to make the next sends fail, as a provider outage would. */
  failing = false;

  send(message: SmsMessage): Promise<{ id: string }> {
    if (this.failing) {
      return Promise.reject(new Error('SMS provider unavailable'));
    }
    this.sent.push(message);
    return Promise.resolve({ id: randomUUID() });
  }

  /** The code in the last SMS sent to this number; tests only. */
  lastCodeFor(to: string): string | undefined {
    return this.sent.findLast((message) => message.to === to)?.params.code;
  }
}

export class FakePaymentGateway implements PaymentGateway {
  readonly orders = new Map<string, { amountPaise: number; receipt: string; paid: boolean }>();
  readonly refunds: { paymentId: string; amountPaise: number }[] = [];
  readonly transfers: { providerId: string; amountPaise: number; reference: string }[] = [];
  readonly mandates = new Map<string, { maxAmountPaise: number; active: boolean }>();
  /** Set by a test to make refunds fail, as a gateway outage would. */
  failingRefunds = false;
  /** Set by a test: this many more refunds succeed, then every refund fails (a mid-run outage). */
  refundsBeforeOutage: number | undefined;
  /** Set by a test to make transfers fail, as a gateway outage would. */
  failingTransfers = false;
  private readonly refundsByKey = new Map<string, string>();
  private readonly transfersByReference = new Map<string, string>();

  constructor(private readonly webhookSecret = 'fake-webhook-secret') {}

  createOrder(order: { amountPaise: number; receipt: string }): Promise<{ orderId: string }> {
    const orderId = `order_${randomUUID()}`;
    this.orders.set(orderId, { ...order, paid: false });
    return Promise.resolve({ orderId });
  }

  /** Same scheme as common gateways: hex HMAC-SHA-256 of the raw payload. */
  sign(payload: string): string {
    return createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
  }

  verifyWebhook(payload: string, signature: string): boolean {
    return this.sign(payload) === signature;
  }

  parseEvent(payload: string): GatewayEvent {
    return JSON.parse(payload) as GatewayEvent;
  }

  /** The signed webhook the gateway would send when the patient pays this order. */
  sandboxCapture(
    orderId: string,
    eventId = `evt_${randomUUID()}`,
  ): { body: string; signature: string } {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Unknown order');
    order.paid = true;
    const event: GatewayEvent = {
      id: eventId,
      kind: 'payment.captured',
      orderId,
      paymentId: `pay_${orderId.slice(6, 20)}`,
      amountPaise: order.amountPaise,
    };
    const body = JSON.stringify(event);
    return { body, signature: this.sign(body) };
  }

  sandboxFail(orderId: string): { body: string; signature: string } {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Unknown order');
    const event: GatewayEvent = {
      id: `evt_${randomUUID()}`,
      kind: 'payment.failed',
      orderId,
      paymentId: `pay_${orderId.slice(6, 20)}`,
      amountPaise: order.amountPaise,
    };
    const body = JSON.stringify(event);
    return { body, signature: this.sign(body) };
  }

  createMandate(mandate: {
    reference: string;
    maxAmountPaise: number;
  }): Promise<{ mandateId: string }> {
    const mandateId = `mdt_${randomUUID().slice(0, 14)}`;
    this.mandates.set(mandateId, { maxAmountPaise: mandate.maxAmountPaise, active: true });
    return Promise.resolve({ mandateId });
  }

  /** Refuses a debit above the cap or on a revoked mandate, as a gateway would. */
  chargeMandate(charge: {
    mandateId: string;
    amountPaise: number;
    receipt: string;
  }): Promise<{ orderId: string }> {
    const mandate = this.mandates.get(charge.mandateId);
    if (!mandate?.active || charge.amountPaise > mandate.maxAmountPaise)
      return Promise.reject(new Error('Mandate cannot be charged'));
    return this.createOrder({ amountPaise: charge.amountPaise, receipt: charge.receipt });
  }

  cancelMandate(mandateId: string): Promise<void> {
    const mandate = this.mandates.get(mandateId);
    if (mandate) mandate.active = false;
    return Promise.resolve();
  }

  /** Idempotent by key, as the gateway's idempotency header is: a repeat pays nothing more. */
  refund(payment: {
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }> {
    const known = this.refundsByKey.get(payment.idempotencyKey);
    if (known) return Promise.resolve({ refundId: known });
    if (this.failingRefunds || this.refundsBeforeOutage === 0)
      return Promise.reject(new Error('Gateway unavailable'));
    if (this.refundsBeforeOutage !== undefined) this.refundsBeforeOutage -= 1;
    const refundId = `rfnd_${randomUUID().slice(0, 14)}`;
    this.refundsByKey.set(payment.idempotencyKey, refundId);
    this.refunds.push({ paymentId: payment.paymentId, amountPaise: payment.amountPaise });
    return Promise.resolve({ refundId });
  }

  transfer(payout: {
    providerId: string;
    amountPaise: number;
    reference: string;
  }): Promise<{ transferId: string }> {
    const known = this.transfersByReference.get(payout.reference);
    if (known) return Promise.resolve({ transferId: known });
    if (this.failingTransfers) return Promise.reject(new Error('Gateway unavailable'));
    const transferId = `trf_${randomUUID().slice(0, 14)}`;
    this.transfersByReference.set(payout.reference, transferId);
    this.transfers.push(payout);
    return Promise.resolve({ transferId });
  }

  orderStatus(orderId: string): Promise<{ paid: boolean; amountPaise: number } | undefined> {
    const order = this.orders.get(orderId);
    return Promise.resolve(order && { paid: order.paid, amountPaise: order.amountPaise });
  }
}

export class FakeVideoRooms implements VideoRooms {
  readonly rooms = new Map<string, string>();

  createRoom(bookingId: string): Promise<{ roomId: string }> {
    const roomId = randomUUID();
    this.rooms.set(roomId, bookingId);
    return Promise.resolve({ roomId });
  }

  joinToken(roomId: string, participantId: string): Promise<string> {
    return Promise.resolve(`fake-token:${roomId}:${participantId}`);
  }
}

export class FakeIdentityVerifier implements IdentityVerifier {
  /** Sends the person straight back as if they had consented; the code `approved` verifies. */
  startConsent(reference: string, returnUrl: string): Promise<{ redirectUrl: string }> {
    const url = new URL(returnUrl);
    url.searchParams.set('code', 'approved');
    url.searchParams.set('ref', reference);
    return Promise.resolve({ redirectUrl: url.toString() });
  }

  completeConsent(
    code: string,
  ): Promise<{ verified: boolean; documentType: 'aadhaar' | 'digilocker' }> {
    return Promise.resolve({ verified: code === 'approved', documentType: 'digilocker' });
  }
}

/** Objects in this process's memory: lost on restart, so local and test only until D-SCAN and S3. */
export class InMemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, string>();

  put(key: string, body: string): Promise<void> {
    this.objects.set(key, body);
    return Promise.resolve();
  }

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.objects.get(key));
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

/** The industry test signature, so tests can prove infected files are quarantined. */
export const EICAR_MARKER = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export class FakeVirusScanner implements VirusScanner {
  scan(content: Buffer): Promise<'clean' | 'infected'> {
    return Promise.resolve(
      content.toString('latin1').includes(EICAR_MARKER) ? 'infected' : 'clean',
    );
  }
}
