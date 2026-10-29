/** A gateway webhook event, already parsed from the signed body (PY-01). */
export interface GatewayEvent {
  id: string;
  kind: 'payment.captured' | 'payment.failed';
  orderId: string;
  paymentId: string;
  amountPaise: number;
}

/**
 * Payment gateway with split settlement (PY-01, PY-02, PY-05; recommended: Razorpay Route).
 * Card and UPI details stay on the gateway's hosted checkout (PY-07); this API sees only orders,
 * payments, refunds and transfers by their IDs.
 */
export interface PaymentGateway {
  createOrder(order: { amountPaise: number; receipt: string }): Promise<{ orderId: string }>;
  verifyWebhook(payload: string, signature: string): boolean;
  parseEvent(payload: string): GatewayEvent;
  refund(payment: { paymentId: string; amountPaise: number }): Promise<{ refundId: string }>;
  /** Releases a provider's settled earnings to their linked account (the weekly payout run). */
  transfer(payout: {
    providerId: string;
    amountPaise: number;
    reference: string;
  }): Promise<{ transferId: string }>;
  /**
   * Recurring payments (PK-05): a UPI Autopay or card mandate the patient authorises on the
   * gateway's page, capped at `maxAmountPaise` per debit. The fake authorises at once; the real
   * adapter confirms authorisation by webhook before the first charge.
   */
  createMandate(mandate: {
    reference: string;
    maxAmountPaise: number;
  }): Promise<{ mandateId: string }>;
  /** Debits an authorised mandate; the outcome arrives as a webhook on the returned order. */
  chargeMandate(charge: {
    mandateId: string;
    amountPaise: number;
    receipt: string;
  }): Promise<{ orderId: string }>;
  /** Revokes a mandate so no further debit can happen (PK-06). */
  cancelMandate(mandateId: string): Promise<void>;
  /** The gateway's view of an order, for daily reconciliation (LM-06). */
  orderStatus(orderId: string): Promise<{ paid: boolean; amountPaise: number } | undefined>;
  /**
   * Sandbox only: the signed webhook the gateway would send if this order were paid. Stands in
   * for the hosted checkout until the gateway account exists (partner issue #19).
   */
  sandboxCapture?(orderId: string): { body: string; signature: string };
  /** Sandbox only: the signed webhook for a failed debit of this order. */
  sandboxFail?(orderId: string): { body: string; signature: string };
}
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
