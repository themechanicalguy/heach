import type { FieldEncryptor } from '@heach/crypto';
import type { Locale } from '@heach/i18n';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { SMS_SENDER, type SmsSender, type SmsTemplate } from '../adapters/sms.port.js';
import { appLogger } from '../common/app-logger.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';

/**
 * Sends an account a transactional SMS in its own language (NT-01, NT-03). Template text never
 * carries health detail (SE-09). A failed send is logged without the number and never undoes the
 * action that caused it.
 */
@Injectable()
export class Notifier {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async smsAccount(
    accountId: string,
    templateId: SmsTemplate,
    params: Record<string, string> = {},
  ): Promise<boolean> {
    const { rows } = await this.pool.query<{
      mobile: Parameters<FieldEncryptor['decrypt']>[0] | null;
      locale: Locale;
    }>('SELECT mobile, preferred_locale AS locale FROM app.account WHERE id = $1', [accountId]);
    const account = rows[0];
    if (!account?.mobile) return false;
    try {
      const to = await this.encryptor.decrypt(account.mobile);
      await this.sms.send({ to, locale: account.locale, templateId, params });
      return true;
    } catch {
      appLogger.warn({ templateId }, 'SMS not sent');
      return false;
    }
  }
}
