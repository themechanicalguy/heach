/** Payment gateway: orders in paise and signed webhook checks (PY, Step 5). */
export interface PaymentGateway {
  createOrder(order: { amountPaise: number; receipt: string }): Promise<{ orderId: string }>;
  verifyWebhook(payload: string, signature: string): boolean;
}
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
