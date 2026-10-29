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
    const booking = payment && (await this.bookings.find(payment.bookingId));
    if (booking?.bookerId !== principalOf(request).userId) throw new NotFoundException();
    const { body, signature } = this.gateway.sandboxCapture(orderId);
    return { outcome: await this.events.handle(body, signature) };
  }
}
