import { Global, Module } from '@nestjs/common';
import { UploadsService } from './uploads.service.js';

/** Secure upload pipeline shared by onboarding, bookings, labs and the vault (EN-07). */
@Global()
@Module({ providers: [UploadsService], exports: [UploadsService] })
export class UploadsModule {}
