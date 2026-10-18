import { createHmac, randomUUID } from 'node:crypto';
import type { IdentityVerifier } from './identity.port.js';
import type { PaymentGateway } from './payments.port.js';
import type { SmsSender } from './sms.port.js';
import type { VideoRooms } from './video.port.js';

/**
 * Test doubles for the third parties (TS-06.1). They record calls in memory and never touch a
 * network. Only adapters.module.ts and tests may import this file (lint boundary).
 */
export class FakeSmsSender implements SmsSender {
  readonly sent: Parameters<SmsSender['send']>[0][] = [];

  send(message: Parameters<SmsSender['send']>[0]): Promise<{ id: string }> {
    this.sent.push(message);
    return Promise.resolve({ id: randomUUID() });
  }
}

export class FakePaymentGateway implements PaymentGateway {
  readonly orders: { amountPaise: number; receipt: string }[] = [];

  constructor(private readonly webhookSecret = 'fake-webhook-secret') {}

  createOrder(order: { amountPaise: number; receipt: string }): Promise<{ orderId: string }> {
    this.orders.push(order);
    return Promise.resolve({ orderId: `order_${randomUUID()}` });
  }

  /** Same scheme as common gateways: hex HMAC-SHA-256 of the raw payload. */
  sign(payload: string): string {
    return createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
  }

  verifyWebhook(payload: string, signature: string): boolean {
    return this.sign(payload) === signature;
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
  startConsent(reference: string): Promise<{ redirectUrl: string }> {
    return Promise.resolve({
      redirectUrl: `https://identity.invalid/consent?ref=${encodeURIComponent(reference)}`,
    });
  }

  completeConsent(
    code: string,
  ): Promise<{ verified: boolean; documentType: 'aadhaar' | 'digilocker' }> {
    return Promise.resolve({ verified: code === 'approved', documentType: 'digilocker' });
  }
}
