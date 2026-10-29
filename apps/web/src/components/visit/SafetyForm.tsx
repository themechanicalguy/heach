'use client';

import { Button, Card, Notice, TextField } from '@heach/ui';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { Select } from '../care/SearchView';

const TOPICS = [
  'safety_threat',
  'harassment',
  'clinical_emergency',
  'service_quality',
  'billing',
  'no_show',
  'other',
] as const;

/**
 * "Report a safety concern" (HS-06) or a complaint (RF-03) on a booking. A safety concern opens
 * with the emergency steps first (A17: call 108, then tell the family).
 */
export function SafetyForm({
  bookingId,
  kind = 'safety',
}: Readonly<{ bookingId: string; kind?: 'safety' | 'complaint' }>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string>(
    kind === 'safety' ? 'safety_threat' : 'service_quality',
  );
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const { pending, error, run } = usePending();
  const label = kind === 'safety' ? t('safety.report') : t('tickets.complain');
  if (!open) {
    return (
      <Button
        className={kind === 'safety' ? 'heach-button--danger' : 'heach-button--secondary'}
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </Button>
    );
  }
  if (sent)
    return (
      <Notice tone="success" live>
        {t('safety.sent')}
      </Notice>
    );
  const send = () =>
    run(async () => {
      const body = { bookingId, kind, topic, ...(description ? { description } : {}) };
      await api('/tickets', { method: 'POST', body: JSON.stringify(body) });
      setSent(true);
    });
  return (
    <Card title={kind === 'safety' ? t('safety.title') : label}>
      {kind === 'safety' && <Notice tone="danger">{t('safety.sop')}</Notice>}
      <Select
        label={t('safety.topic')}
        value={topic}
        onChange={setTopic}
        options={TOPICS.map((value) => [value, t(`safety.topics.${value}`)] as const)}
      />
      <TextField
        label={t('safety.description')}
        multiline
        maxLength={1000}
        value={description}
        onChange={(event) => {
          setDescription(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void send()} disabled={pending}>
        {t('safety.send')}
      </Button>
    </Card>
  );
}
