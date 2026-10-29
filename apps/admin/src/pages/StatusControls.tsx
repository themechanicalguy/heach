import { Button, Notice } from '@heach/ui';
import type { UserDetail } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { useReverified } from '../use-reverified';

const REASONS = ['safety_concern', 'fraud', 'policy_breach', 'user_request', 'other'] as const;

/** Suspend with a reason, or reinstate; asks for a fresh TOTP code when the API requires one. */
export function StatusControls({
  user,
  onChanged,
}: Readonly<{ user: UserDetail; onChanged: (message: string) => void }>) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>('other');
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const suspend = user.status === 'active';

  const change = () =>
    attempt(async () => {
      await api(`/users/${user.id}/${suspend ? 'suspend' : 'reinstate'}`, {
        method: 'POST',
        ...(suspend ? { body: JSON.stringify({ reason }) } : {}),
      });
      onChanged(suspend ? t('users.suspended') : t('users.reinstated'));
    });

  return (
    <div className="admin-form">
      {error !== undefined && (
        <Notice tone="danger" live>
          {errorText(error)}
        </Notice>
      )}
      {suspend && (
        <label className="admin-select">
          <span>{t('users.reason')}</span>
          <select
            value={reason}
            onChange={(event) => {
              setReason(event.target.value as typeof reason);
            }}
          >
            {REASONS.map((each) => (
              <option key={each} value={each}>
                {t(`users.reasons.${each}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        className={suspend ? 'heach-button--danger' : undefined}
        disabled={pending}
        onClick={() => void change()}
      >
        {suspend ? t('users.suspend') : t('users.reinstate')}
      </Button>
      {sheet}
    </div>
  );
}
