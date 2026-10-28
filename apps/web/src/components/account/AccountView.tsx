'use client';

import { Button, Card, Notice } from '@heach/ui';
import type { Me } from '@heach/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor } from '../../lib/routing';
import { useSession } from '../../lib/session';
import { usePending } from '../../lib/use-pending';
import { AddRole } from './AddRole';

/** Account details, roles and role switching, and sign-out of one or every device (AC-05, SE-07). */
export function AccountView({ me }: Readonly<{ me: Me }>) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { switchRole } = useAccount();
  const { signOut, signOutAll } = useSession();
  const [switched, setSwitched] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  const roleName = (role: string) => t(`roles.${role as Me['activeRole']}.name`);

  const chooseRole = (role: string) =>
    run(async () => {
      const next = await switchRole(role);
      setSwitched(roleName(role));
      router.push(destinationFor(next));
    });
  const leave = (everywhere: boolean) =>
    run(async () => {
      await (everywhere ? signOutAll() : signOut());
      router.replace(`/${locale}/sign-in`);
    });

  return (
    <section className="flow" aria-labelledby="account-title">
      <div className="flow__card">
        <h1 id="account-title" className="flow__title">
          {t('account.title')}
        </h1>
        <dl className="facts">
          <dt>{t('account.mobile')}</dt>
          <dd>{me.mobile ?? '—'}</dd>
          <dt>{t('account.language')}</dt>
          <dd lang={me.locale}>{t(`locale.${me.locale}`)}</dd>
        </dl>
        <h2 className="flow__subtitle">{t('account.rolesTitle')}</h2>
        <ul className="role-list">
          {me.roles.map((grant) => (
            <li key={grant.role}>
              <Card title={t(`roles.${grant.role}.label`)}>
                {grant.role === me.activeRole ? (
                  <p className="role-list__active">{t('account.using')}</p>
                ) : (
                  <Button
                    className="heach-button--secondary"
                    disabled={pending}
                    onClick={() => void chooseRole(grant.role)}
                  >
                    {t('account.switchTo', { role: roleName(grant.role) })}
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
        {switched && (
          <Notice tone="success" live>
            {t('account.switched', { role: switched })}
          </Notice>
        )}
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
      </div>
      {me.roles.length < 2 && <AddRole me={me} />}
      <div className="flow__card">
        <Button
          className="heach-button--secondary"
          disabled={pending}
          onClick={() => void leave(false)}
        >
          {t('account.signOut')}
        </Button>
        <p className="flow__muted">{t('account.signOutAllHint')}</p>
        <Button
          className="heach-button--danger"
          disabled={pending}
          onClick={() => void leave(true)}
        >
          {t('account.signOutAll')}
        </Button>
      </div>
    </section>
  );
}
