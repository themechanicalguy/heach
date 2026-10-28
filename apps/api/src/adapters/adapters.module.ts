import { Global, Module } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';
import {
  FakeIdentityVerifier,
  FakePaymentGateway,
  FakeSmsSender,
  FakeVideoRooms,
} from './fakes.js';
import { IDENTITY_VERIFIER } from './identity.port.js';
import { MailpitSmsSender } from './mailpit-sms.adapter.js';
import { PAYMENT_GATEWAY } from './payments.port.js';
import { SMS_SENDER, type SmsSender } from './sms.port.js';
import { VIDEO_ROOMS } from './video.port.js';

const LOCAL_SMS_ENVS = new Set(['local', 'test']);

/** The SMS adapter for this environment; Mailpit delivery never runs on a host (decision L-8). */
export function createSmsSender(env: EnvVars): SmsSender {
  if (env.SMS_PROVIDER === 'fake') {
    return new FakeSmsSender();
  }
  if (!LOCAL_SMS_ENVS.has(env.APP_ENV)) {
    throw new Error(`SMS provider ${env.SMS_PROVIDER} is not allowed in ${env.APP_ENV}`);
  }
  return new MailpitSmsSender(env.MAILPIT_API_URL);
}

/**
 * Binds each third-party port to an implementation. Only test doubles and the local Mailpit SMS
 * tool exist; the real providers arrive with the steps that use them and are chosen here by
 * environment.
 */
@Global()
@Module({
  providers: [
    { provide: SMS_SENDER, inject: [EnvVars], useFactory: createSmsSender },
    { provide: PAYMENT_GATEWAY, useClass: FakePaymentGateway },
    { provide: VIDEO_ROOMS, useClass: FakeVideoRooms },
    { provide: IDENTITY_VERIFIER, useClass: FakeIdentityVerifier },
  ],
  exports: [SMS_SENDER, PAYMENT_GATEWAY, VIDEO_ROOMS, IDENTITY_VERIFIER],
})
export class AdaptersModule {}
