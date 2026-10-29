import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  type RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../adapters/payments.port.js';
import { principalOf } from '../auth/auth.guard.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { reason } from '../common/error-response.js';
import { CARE_ROLES } from '../common/request-context.js';
import { EnvVars } from '../config/env.schema.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type pg from 'pg';
import { requireFlag } from '../flags/flags.module.js';
import { PaymentsRepository } from '../payments/payments.repository.js';
import { BookingRepository } from './booking.repository.js';
import { PaymentEventsService, type WebhookOutcome } from './payment-events.service.js';

/** Environments where the sandbox stands in for the gateway's hosted checkout (#19 pending). */
const SANDBOX_ENVS = new Set(['local', 'test', 'dev']);

/** Gateway webhooks (PY-01), and the sandbox payment that stands in for hosted checkout. */
@ApiTags('payments')
@Controller('v1/payments')
@UseGuards(requireFlag('accounts'))
export class PaymentsController {
  constructor(
    private readonly events: PaymentEventsService,
    private readonly payments: PaymentsRepository,
    private readonly bookings: BookingRepository,
    private readonly env: EnvVars,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Public('The gateway calls it; the signature on the raw body is the authentication')
  @ApiOkResponse()
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-gateway-signature') signature: string | undefined,
  ): Promise<{ outcome: WebhookOutcome }> {
    const body = request.rawBody?.toString('utf8');
    if (!body) throw reason(BadRequestException, 'webhook_signature');
    return { outcome: await this.events.handle(body, signature ?? '') };
  }

  /** Sandbox only: pays one of the caller's own orders as the hosted checkout would. */
  @Post('sandbox/:orderId/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(...CARE_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse()
  async sandboxPay(
    @Param('orderId') orderId: string,
    @Req() request: Request,
  ): Promise<{ outcome: WebhookOutcome }> {
    if (!this.gateway.sandboxCapture || !SANDBOX_ENVS.has(this.env.APP_ENV))
      throw new NotFoundException();
    const payment = await this.payments.byOrder(orderId);
    if (!payment || !(await this.paysOwn(principalOf(request).userId, payment)))
      throw new NotFoundException();
    const { body, signature } = this.gateway.sandboxCapture(orderId);
    return { outcome: await this.events.handle(body, signature) };
  }

  /** The order is the caller's own: their booking, or their plan purchase. */
  private async paysOwn(
    accountId: string,
    payment: { bookingId: string | null; purchaseId: string | null },
  ): Promise<boolean> {
    if (payment.purchaseId) {
      const { rows } = await this.pool.query(
        'SELECT 1 FROM app.plan_purchase WHERE id = $1 AND buyer_account_id = $2',
        [payment.purchaseId, accountId],
      );
      return rows.length === 1;
    }
    const booking = payment.bookingId ? await this.bookings.find(payment.bookingId) : undefined;
    return booking?.bookerId === accountId;
  }
}
