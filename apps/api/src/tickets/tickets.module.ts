import { Global, Module } from '@nestjs/common';
import { AdminTicketsController, TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

/** Tickets, the admin queue and break-glass (HS-06, RF-03, AD-06, SE-03, SE-06). */
@Global()
@Module({
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
