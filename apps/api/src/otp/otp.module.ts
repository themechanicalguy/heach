import { Module } from '@nestjs/common';
import { EnvVars } from '../config/env.schema.js';
import { OtpHasher } from './otp-code.js';
import { OtpThrottle } from './otp-throttle.js';
import { OtpRepository } from './otp.repository.js';
import { OtpService } from './otp.service.js';

/** One-time passwords by SMS for sign-in and re-verification (decision L-6). */
@Module({
  providers: [
    OtpRepository,
    OtpThrottle,
    OtpService,
    {
      provide: OtpHasher,
      inject: [EnvVars],
      useFactory: (env: EnvVars) => new OtpHasher(Buffer.from(env.BLIND_INDEX_KEY, 'hex')),
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
