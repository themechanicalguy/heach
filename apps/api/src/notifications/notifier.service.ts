import { randomUUID } from 'node:crypto';
import type { FieldEncryptor } from '@heach/crypto';
import { formatDateTime, type Locale } from '@heach/i18n';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { SMS_SENDER, type SmsSender, type SmsTemplate } from '../adapters/sms.port.js';
import { appLogger } from '../common/app-logger.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

type EncryptedMobile = Parameters<FieldEncryptor['decrypt']>[0];

/** Params named `time` are instants (ISO strings), shown in the recipient's language in IST. */
function localise(params: Record<string, string>, locale: Locale): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      key === 'time' ? formatDateTime(new Date(value), locale) : value,
    ]),
  );
}

/**
 * Tells an account something (NT-01 to NT-03): an in-app notification and an SMS in the
 * account's own language. Template text never carries health detail (SE-09). A failed SMS is
 * logged without the number and never undoes the action that caused it.
 */
@Injectable()
export class Notifier {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async notify(
    accountId: string,
    templateId: SmsTemplate,
    params: Record<string, string> = {},
    bookingId?: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO app.notification (id, account_id, template, params, booking_id) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), accountId, templateId, params, bookingId ?? null],
    );
    await this.smsAccount(accountId, templateId, params);
  }

  async smsAccount(
    accountId: string,
    templateId: SmsTemplate,
    params: Record<string, string> = {},
  ): Promise<boolean> {
    const { rows } = await this.pool.query<{ mobile: EncryptedMobile | null; locale: Locale }>(
      'SELECT mobile, preferred_locale AS locale FROM app.account WHERE id = $1',
      [accountId],
    );
    const account = rows[0];
    if (!account?.mobile) return false;
    try {
      const to = await this.encryptor.decrypt(account.mobile);
      await this.sms.send({
        to,
        locale: account.locale,
        templateId,
        params: localise(params, account.locale),
      });
      return true;
    } catch {
      appLogger.warn({ templateId }, 'SMS not sent');
      return false;
    }
  }
}
