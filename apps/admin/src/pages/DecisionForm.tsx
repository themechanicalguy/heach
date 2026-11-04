import { Button, Notice } from '@heach/ui';
import { useId, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import en from '../../messages/en.json';

const REASONS = Object.keys(en.verification.reasons) as (keyof typeof en.verification.reasons)[];

/**
 * Approve, request changes or reject (AD-02, G18): a compact reason list instead of six cards.
 * A reason must be chosen before asking for changes or rejecting; approving needs none.
 */
export function DecisionForm({
  accountId,
  onDecided,
}: Readonly<{ accountId: string; onDecided: () => void }>) {
  const [reason, setReason] = useState('');
  const { pending, error, run } = usePending();
  const hintId = useId();
  const decide = (decision: 'approve' | 'request_changes' | 'reject') =>
    run(async () => {
      const body = decision === 'approve' ? { decision } : { decision, reason };
      await api(`/applications/${accountId}/decision`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onDecided();
    });
  return (
    <section className="admin-decision" aria-label={t('verification.decisionTitle')}>
      <h3>{t('verification.decisionTitle')}</h3>
      <label className="admin-select">
        <span>{t('verification.reason')}</span>
        <select
          value={reason}
          aria-describedby={hintId}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        >
          <option value="">{t('verification.reasonPlaceholder')}</option>
          {REASONS.map((value) => (
            <option key={value} value={value}>
              {t(`verification.reasons.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p id={hintId} className="admin-muted">
        {t('verification.reasonHint')}
      </p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <div className="admin-decision__buttons">
        <Button onClick={() => void decide('approve')} disabled={pending}>
          {t('verification.approve')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => void decide('request_changes')}
          disabled={pending || !reason}
        >
          {t('verification.requestChanges')}
        </Button>
        <Button
          className="heach-button--danger"
          onClick={() => void decide('reject')}
          disabled={pending || !reason}
        >
          {t('verification.rejectApplication')}
        </Button>
      </div>
    </section>
  );
}
