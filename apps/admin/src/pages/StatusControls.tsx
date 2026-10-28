import { Button, Notice } from '@heach/ui';
import type { UserDetail } from '@heach/types';
import { useState } from 'react';
import { api, ApiError } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { ReverifySheet } from './ReverifySheet';

const REASONS = ['safety_concern', 'fraud', 'policy_breach', 'user_request', 'other'] as const;

/** Suspend with a reason, or reinstate; asks for a fresh TOTP code when the API requires one. */
export function StatusControls({
  user,
  onChanged,
}: Readonly<{ user: UserDetail; onChanged: (message: string) => void }>) {
  const [reason, setReason] = useState<(typeof REASONS)[number]>('other');
  const [verify, setVerify] = useState(false);
  const { pending, error, run } = usePending();
  const suspend = user.status === 'active';

  const change = () =>
    run(async () => {
      try {
        await api(`/users/${user.id}/${suspend ? 'suspend' : 'reinstate'}`, {
          method: 'POST',
          ...(suspend ? { body: JSON.stringify({ reason }) } : {}),
        });
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'reverification_required') {
          setVerify(true);
          return;
        }
        throw caught;
      }
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
      <ReverifySheet
        open={verify}
        onClose={() => {
          setVerify(false);
        }}
        onVerified={() => {
          setVerify(false);
          void change();
        }}
      />
    </div>
  );
}
