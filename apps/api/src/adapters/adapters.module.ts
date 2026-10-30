import { Global, Module } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';
import {
  FakeIdentityVerifier,
  FakePaymentGateway,
  FakeSmsSender,
  FakeVideoRooms,
  FakeVirusScanner,
  InMemoryObjectStore,
} from './fakes.js';
import { IDENTITY_VERIFIER } from './identity.port.js';
import { MailpitSmsSender } from './mailpit-sms.adapter.js';
import { OBJECT_STORE } from './object-store.port.js';
import { PAYMENT_GATEWAY } from './payments.port.js';
import { VIRUS_SCANNER } from './scanner.port.js';
import { SMS_SENDER, type SmsSender } from './sms.port.js';
import { VIDEO_ROOMS } from './video.port.js';

// Dev too: its Mailpit inbox is loopback only, for synthetic numbers (decision L-8, as amended).
const MAILPIT_SMS_ENVS = new Set(['local', 'test', 'dev']);

/** The SMS adapter for this environment; Mailpit delivery never runs in staging or production. */
export function createSmsSender(env: EnvVars): SmsSender {
  if (env.SMS_PROVIDER === 'fake') {
    return new FakeSmsSender();
  }
  if (!MAILPIT_SMS_ENVS.has(env.APP_ENV)) {
    throw new Error(`SMS provider ${env.SMS_PROVIDER} is not allowed in ${env.APP_ENV}`);
  }
  return new MailpitSmsSender(env.MAILPIT_API_URL);
}

/**
 * Binds each third-party port to an implementation. Only test doubles and the Mailpit SMS
 * developer tool exist; the real providers arrive with the steps that use them and are chosen here by
 * environment.
 */
@Global()
@Module({
  providers: [
    { provide: SMS_SENDER, inject: [EnvVars], useFactory: createSmsSender },
    { provide: PAYMENT_GATEWAY, useClass: FakePaymentGateway },
    { provide: VIDEO_ROOMS, useClass: FakeVideoRooms },
    { provide: IDENTITY_VERIFIER, useClass: FakeIdentityVerifier },
    { provide: OBJECT_STORE, useClass: InMemoryObjectStore },
    { provide: VIRUS_SCANNER, useClass: FakeVirusScanner },
  ],
  exports: [
    SMS_SENDER,
    PAYMENT_GATEWAY,
    VIDEO_ROOMS,
    IDENTITY_VERIFIER,
    OBJECT_STORE,
    VIRUS_SCANNER,
  ],
})
export class AdaptersModule {}
