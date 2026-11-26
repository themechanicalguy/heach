import { Global, Module } from '@nestjs/common';
import type { AppEnv } from '../config/env.schema.js';
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

/**
 * Where test doubles may run: local machines, tests and the dev host (synthetic data only, the
 * Mailpit inbox loopback only; decision L-8, as amended). Never staging or production: there the
 * payment double would accept a webhook signed with a secret in this repository, the scanner
 * double would pass any file, the identity double any code, and files would live in memory.
 */
export const TEST_DOUBLE_ENVS: ReadonlySet<AppEnv> = new Set(['local', 'test', 'dev']);

/** A test double for `port`, or a refusal to start where only the real provider may run. */
export function testDouble<T>(env: Pick<EnvVars, 'APP_ENV'>, port: string, make: () => T): T {
  if (!TEST_DOUBLE_ENVS.has(env.APP_ENV)) {
    throw new Error(
      `No ${port} adapter for ${env.APP_ENV}: test doubles run only in local, test and dev`,
    );
  }
  return make();
}

/** The SMS adapter for this environment; neither double ever runs in staging or production. */
export function createSmsSender(env: EnvVars): SmsSender {
  if (env.SMS_PROVIDER === 'fake') return testDouble(env, 'SMS', () => new FakeSmsSender());
  if (!TEST_DOUBLE_ENVS.has(env.APP_ENV)) {
    throw new Error(`SMS provider ${env.SMS_PROVIDER} is not allowed in ${env.APP_ENV}`);
  }
  return new MailpitSmsSender(env.MAILPIT_API_URL);
}

const double = <T>(port: string, make: () => T) => ({
  inject: [EnvVars],
  useFactory: (env: EnvVars) => testDouble(env, port, make),
});

/**
 * Binds each third-party port to an implementation. Only test doubles and the Mailpit SMS
 * developer tool exist; the real providers arrive with the steps that use them and are chosen
 * here by environment. Until then the API refuses to start in staging or production.
 */
@Global()
@Module({
  providers: [
    { provide: SMS_SENDER, inject: [EnvVars], useFactory: createSmsSender },
    { provide: PAYMENT_GATEWAY, ...double('payment gateway', () => new FakePaymentGateway()) },
    { provide: VIDEO_ROOMS, ...double('video', () => new FakeVideoRooms()) },
    { provide: IDENTITY_VERIFIER, ...double('identity', () => new FakeIdentityVerifier()) },
    { provide: OBJECT_STORE, ...double('object store', () => new InMemoryObjectStore()) },
    { provide: VIRUS_SCANNER, ...double('virus scanner', () => new FakeVirusScanner()) },
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
