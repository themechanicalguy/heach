import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { Notifier } from './notifier.service.js';

/** Transactional messages to accounts (NT). */
@Global()
@Module({ controllers: [NotificationsController], providers: [Notifier], exports: [Notifier] })
export class NotificationsModule {}
