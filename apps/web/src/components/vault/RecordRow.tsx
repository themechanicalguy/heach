'use client';

import { formatDate, type Locale } from '@heach/i18n';
import { Icon } from '@heach/ui';
import type { VaultRecord } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { RecordActions, type RecordActionProps } from './RecordActions';
import { RecordDetails, RecordIssuer } from './RecordCard';
import { TYPE_ICON } from './record-types';

export function recordDate(record: VaultRecord, locale: Locale) {
  return formatDate(new Date(`${record.recordDate}T00:00:00+05:30`), locale);
}

/**
 * One record as a scannable row (G11, Records A and the desktop records board): a type icon, the
 * title, type and date, and who it came from as a badge. Opening it shows the details and the
 * actions the owner is allowed, sharing included (G12).
 */
export function RecordRow(props: Readonly<RecordActionProps>) {
  const { locale, t } = useI18n();
  const { record } = props;
  const { icon, tone } = TYPE_ICON[record.recordType];
  return (
    <details className="record-row">
      <summary className="record-row__summary">
        <span className={`record-row__icon record-row__icon--${tone}`}>
          <Icon name={icon} size={22} />
        </span>
        <span className="record-row__main">
          <strong className="record-row__title">{record.title}</strong>
          <span className="record-row__meta">
            {t(keyFor('vault.types', record.recordType, 'vault.types.other'))} ·{' '}
            {recordDate(record, locale)}
          </span>
          <RecordIssuer record={record} />
        </span>
        <span className="record-row__chevron">
          <Icon name="chevron-down" size={20} />
        </span>
      </summary>
      <div className="record-row__body">
        <RecordDetails record={record} hideIssuer />
        <RecordActions {...props} />
      </div>
    </details>
  );
}
