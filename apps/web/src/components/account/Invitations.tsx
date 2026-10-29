'use client';

import { Button, Card, Notice } from '@heach/ui';
import type { Invitation } from '@heach/types';
import { formatDate } from '@heach/i18n';
import { useAccount } from '../../lib/account';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { useReverified } from './use-reverified';

/**
 * Staff invitations sent to this number (owner decision O-1). Accepting adds the staff role,
 * after a fresh code, like any added role.
 */
export function Invitations() {
  const { locale, t } = useI18n();
  const { reload: reloadAccount } = useAccount();
  const { resource, reload } = useResource<Invitation[]>('/me/invitations');
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  if (resource.state !== 'ready' || resource.data.length === 0) return null;

  const answer = (invitation: Invitation, accept: boolean) => {
    const path = `/me/invitations/${invitation.id}/${accept ? 'accept' : 'decline'}`;
    const call = async () => {
      await api(path, { method: 'POST' });
      await Promise.all([reload(), reloadAccount()]);
    };
    return accept ? attempt(call) : run(call);
  };

  return (
    <section className="flow__card" aria-labelledby="invitations-title">
      <h2 id="invitations-title" className="flow__subtitle">
        {t('invitations.title')}
      </h2>
      <ul className="role-list">
        {resource.data.map((invitation) => (
          <li key={invitation.id}>
            <Card
              title={t('invitations.choice', {
                role: t(`roles.${invitation.role}.name`),
                organisation: invitation.organisationName,
              })}
            >
              <p className="flow__muted">
                {t('invitations.expires', {
                  date: formatDate(new Date(invitation.expiresAt), locale),
                })}
              </p>
              <Button onClick={() => void answer(invitation, true)} disabled={pending}>
                {t('invitations.accept')}
              </Button>
              <Button
                className="heach-button--secondary"
                onClick={() => void answer(invitation, false)}
                disabled={pending}
              >
                {t('invitations.decline')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {sheet}
    </section>
  );
}
