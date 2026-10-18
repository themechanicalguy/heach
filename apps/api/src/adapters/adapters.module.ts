import { Global, Module } from '@nestjs/common';
import {
  FakeIdentityVerifier,
  FakePaymentGateway,
  FakeSmsSender,
  FakeVideoRooms,
} from './fakes.js';
import { IDENTITY_VERIFIER } from './identity.port.js';
import { PAYMENT_GATEWAY } from './payments.port.js';
import { SMS_SENDER } from './sms.port.js';
import { VIDEO_ROOMS } from './video.port.js';

/**
 * Binds each third-party port to an implementation. Step 2 has only the test doubles; the real
 * providers arrive with the steps that use them and are chosen here by environment.
 */
@Global()
@Module({
  providers: [
    { provide: SMS_SENDER, useClass: FakeSmsSender },
    { provide: PAYMENT_GATEWAY, useClass: FakePaymentGateway },
    { provide: VIDEO_ROOMS, useClass: FakeVideoRooms },
    { provide: IDENTITY_VERIFIER, useClass: FakeIdentityVerifier },
  ],
  exports: [SMS_SENDER, PAYMENT_GATEWAY, VIDEO_ROOMS, IDENTITY_VERIFIER],
})
export class AdaptersModule {}
