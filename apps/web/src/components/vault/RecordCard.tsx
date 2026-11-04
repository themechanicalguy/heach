'use client';

import { formatDate } from '@heach/i18n';
import { Card } from '@heach/ui';
import type { VaultRecord } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { RecordActions, type RecordActionProps } from './RecordActions';

/** One record: the same metadata and authorized actions in cards and desktop rows. */
export function RecordCard(props: Readonly<RecordActionProps>) {
  return (
    <Card title={props.record.title}>
      <RecordDetails record={props.record} />
      <RecordActions {...props} />
    </Card>
  );
}

export function RecordDetails({
  record,
  hideIssuer = false,
}: Readonly<{ record: VaultRecord; hideIssuer?: boolean }>) {
  const { locale, t } = useI18n();
  return (
    <>
      <p className="flow__muted">
        {t(keyFor('vault.types', record.recordType, 'vault.types.other'))} ·{' '}
        {formatDate(new Date(`${record.recordDate}T00:00:00+05:30`), locale)}
      </p>
      {!hideIssuer && <RecordIssuer record={record} />}
      {record.tags.length > 0 && <p>{record.tags.join(', ')}</p>}
      {record.notes && <p>{record.notes}</p>}
      {record.visitNotes && (
        <dl className="facts">
          <dt>{t('visit.procedure')}</dt>
          <dd>{record.visitNotes.procedure}</dd>
          <dt>{t('visit.observations')}</dt>
          <dd>{record.visitNotes.observations}</dd>
          <dt>{t('visit.advice')}</dt>
          <dd>{record.visitNotes.advice}</dd>
        </dl>
      )}
    </>
  );
}

/** Authorship stays visible, as a small badge: issued by a provider or lab, or added by you. */
export function RecordIssuer({ record }: Readonly<{ record: VaultRecord }>) {
  const { t } = useI18n();
  const mine = record.source === 'patient';
  return (
    <span className="source-badge" data-source={mine ? 'self' : 'provider'}>
      {mine
        ? t('vault.addedByYou')
        : t('vault.issuedBy', { name: record.issuedBy ?? record.facility ?? '' })}
    </span>
  );
}
