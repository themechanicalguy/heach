'use client';

import { Button, Card, EmptyState, Notice } from '@heach/ui';
import type { Member } from '@heach/types';
import { formatDate } from '@heach/i18n';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

/** Invited and active staff; ending a membership signs the person out of that role at once. */
export function MemberList({
  members,
  onChanged,
}: Readonly<{ members: Member[]; onChanged: () => Promise<void> }>) {
  const { locale, t } = useI18n();
  const [confirming, setConfirming] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  if (members.length === 0) return <EmptyState message={t('team.empty')} />;
  const end = (id: string) =>
    run(async () => {
      await api(`/organisation/members/${id}`, { method: 'DELETE' });
      setConfirming(undefined);
      await onChanged();
    });
  const state = (member: Member) =>
    member.status === 'active'
      ? t('team.active')
      : t('team.pending', { date: formatDate(new Date(member.expiresAt), locale) });

  return (
    <>
      <h2 className="flow__subtitle">{t('team.membersTitle')}</h2>
      <ul className="role-list">
        {members.map((member) => (
          <li key={member.id}>
            <Card title={member.mobile}>
              <p className="flow__muted">
                {t('team.memberLine', {
                  role: t(`roles.${member.role}.label`),
                  state: state(member),
                })}
              </p>
              {confirming === member.id ? (
                <Button
                  className="heach-button--danger"
                  onClick={() => void end(member.id)}
                  disabled={pending}
                >
                  {t(member.status === 'active' ? 'team.confirmRemove' : 'team.confirmRevoke')}
                </Button>
              ) : (
                <Button
                  className="heach-button--link"
                  onClick={() => {
                    setConfirming(member.id);
                  }}
                  disabled={pending}
                >
                  {t(member.status === 'active' ? 'team.remove' : 'team.revoke')}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </>
  );
}
