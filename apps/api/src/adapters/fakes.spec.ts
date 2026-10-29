import {
  FakeIdentityVerifier,
  FakePaymentGateway,
  FakeSmsSender,
  FakeVideoRooms,
  FakeVirusScanner,
  EICAR_MARKER,
  InMemoryObjectStore,
} from './fakes.js';
import type { IdentityVerifier } from './identity.port.js';
import type { PaymentGateway } from './payments.port.js';
import type { SmsSender } from './sms.port.js';
import type { VideoRooms } from './video.port.js';

describe('Third-party test doubles (TS-06.1)', () => {
  it('TS-06.1 the SMS double records what would be sent', async () => {
    const sms = new FakeSmsSender();
    const port: SmsSender = sms;
    await port.send({
      to: '+919000000001',
      locale: 'en',
      templateId: 'otp_sign_in',
      params: { code: '123456', minutes: '5' },
    });
    expect(sms.sent).toHaveLength(1);
    expect(sms.lastCodeFor('+919000000001')).toBe('123456');
    sms.failing = true;
    await expect(
      port.send({ to: '+919000000001', locale: 'en', templateId: 'otp_sign_in', params: {} }),
    ).rejects.toThrow();
  });

  it('TS-06.1 the payment double creates orders and checks webhook signatures', async () => {
    const gateway = new FakePaymentGateway();
    const port: PaymentGateway = gateway;
    expect((await port.createOrder({ amountPaise: 60000, receipt: 'r1' })).orderId).toMatch(
      /^order_/,
    );
    expect(port.verifyWebhook('{"x":1}', gateway.sign('{"x":1}'))).toBe(true);
    expect(port.verifyWebhook('{"x":2}', gateway.sign('{"x":1}'))).toBe(false);
  });

  it('TS-06.1 the video and identity doubles answer without a network', async () => {
    const video: VideoRooms = new FakeVideoRooms();
    const { roomId } = await video.createRoom('b1');
    expect(await video.joinToken(roomId, 'p1')).toContain(roomId);
    const identity: IdentityVerifier = new FakeIdentityVerifier();
    const back = await identity.startConsent('u1-reference', 'https://web.invalid/en/return');
    expect(back.redirectUrl).toBe('https://web.invalid/en/return?code=approved&ref=u1-reference');
    expect((await identity.completeConsent('approved')).verified).toBe(true);
    expect((await identity.completeConsent('denied')).verified).toBe(false);
  });

  it('TS-06.1 the storage and scanner doubles keep objects and flag the test signature', async () => {
    const store = new InMemoryObjectStore();
    await store.put('k', 'v');
    expect(await store.get('k')).toBe('v');
    await store.delete('k');
    expect(await store.get('k')).toBeUndefined();
    const scanner = new FakeVirusScanner();
    expect(await scanner.scan(Buffer.from('plain'))).toBe('clean');
    expect(await scanner.scan(Buffer.from(`x${EICAR_MARKER}x`))).toBe('infected');
  });
});
