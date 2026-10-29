import { Button, ChoiceGroup, Notice } from '@heach/ui';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import en from '../../messages/en.json';

const REASONS = Object.keys(en.verification.reasons);

/** Approve, request changes or reject (AD-02); a reason is required unless approving. */
export function DecisionForm({
  accountId,
  onDecided,
}: Readonly<{ accountId: string; onDecided: () => void }>) {
  const [reason, setReason] = useState('documents_unclear');
  const { pending, error, run } = usePending();
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
    <section aria-label={t('verification.decisionTitle')}>
      <h3>{t('verification.decisionTitle')}</h3>
      <ChoiceGroup
        legend={t('verification.reason')}
        name="decision-reason"
        value={reason}
        choices={REASONS.map((value) => ({
          value,
          label: t(`verification.reasons.${value as keyof typeof en.verification.reasons}`),
        }))}
        onChange={setReason}
      />
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <div className="admin-actions">
        <Button onClick={() => void decide('approve')} disabled={pending}>
          {t('verification.approve')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => void decide('request_changes')}
          disabled={pending}
        >
          {t('verification.requestChanges')}
        </Button>
        <Button
          className="heach-button--danger"
          onClick={() => void decide('reject')}
          disabled={pending}
        >
          {t('verification.rejectApplication')}
        </Button>
      </div>
    </section>
  );
}
