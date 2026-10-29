import { Global, Module } from '@nestjs/common';
import { Notifier } from './notifier.service.js';

/** Transactional messages to accounts (NT). */
@Global()
@Module({ providers: [Notifier], exports: [Notifier] })
export class NotificationsModule {}
