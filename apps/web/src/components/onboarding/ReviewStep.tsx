'use client';

import { formatDate } from '@heach/i18n';
import { Button, Card, Notice } from '@heach/ui';
import type { Application, ChecklistEntry } from '@heach/types';
import type { ReactNode } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';

export type EditableStep = 'identity' | 'documents' | 'payout';

interface Props {
  application: Application;
  pending: boolean;
  onEdit: (step: EditableStep) => void;
  onSubmit: () => Promise<void>;
}

/** Shows the last four characters only; a shorter value is hidden entirely. */
export function maskTail(value: string): string {
  return value.length > 4 ? `••••${value.slice(-4)}` : '••••';
}

/**
 * Last step (PO-03, PO-04): everything entered so far, read-only, each part with a way back to edit it,
 * then submit. Once submitted the same page stays as a read-only record with no submit button.
 */
export function ReviewStep({ application, pending, onEdit, onSubmit }: Readonly<Props>) {
  const { t } = useI18n();
  const section = (step: EditableStep, children: ReactNode) => (
    <ReviewSection
      title={t(`application.steps.${step}`)}
      onEdit={
        application.editable
          ? () => {
              onEdit(step);
            }
          : undefined
      }
    >
      {children}
    </ReviewSection>
  );
  return (
    <>
      <p className="flow__muted">
        {t(application.editable ? 'application.review.intro' : 'application.review.readOnly')}
      </p>
      <ReviewSection title={t('application.review.applyingAs')}>
        <p>{t(keyFor('roles', application.role, 'application.title', '.label'))}</p>
      </ReviewSection>
      {section('identity', <p>{t(`application.identityState.${application.identity}`)}</p>)}
      {section('documents', <DocumentSummary items={application.items} />)}
      {application.needsPayout && section('payout', <PayoutSummary application={application} />)}
      {application.editable && (
        <SubmitPanel application={application} pending={pending} onSubmit={onSubmit} />
      )}
    </>
  );
}

interface SectionProps {
  title: string;
  onEdit?: (() => void) | undefined;
  children: ReactNode;
}

function ReviewSection({ title, onEdit, children }: Readonly<SectionProps>) {
  const { t } = useI18n();
  return (
    <Card title={title} className="review-section">
      {children}
      {onEdit && (
        <Button
          className="heach-button--ghost"
          onClick={onEdit}
          aria-label={t('application.review.editSection', { section: title })}
        >
          {t('application.review.edit')}
        </Button>
      )}
    </Card>
  );
}

function DocumentSummary({ items }: Readonly<{ items: readonly ChecklistEntry[] }>) {
  const { t } = useI18n();
  return (
    <ul className="review-list">
      {items.map((entry) => (
        <li key={entry.key}>
          <DocumentLine entry={entry} />
          {t(`application.documentState.${entry.document?.scanStatus ?? 'missing'}`)}
        </li>
      ))}
    </ul>
  );
}

function DocumentLine({ entry }: Readonly<{ entry: ChecklistEntry }>) {
  const { locale, t } = useI18n();
  const optional = entry.required ? '' : ` (${t('application.optional')})`;
  const { reference, expiresOn } = entry.document ?? {};
  const details = [
    reference ? t('application.review.number', { value: maskTail(reference) }) : undefined,
    expiresOn
      ? t('application.review.validUntil', {
          date: formatDate(new Date(`${expiresOn}T00:00:00+05:30`), locale),
        })
      : undefined,
  ].filter(Boolean);
  return (
    <>
      <strong>
        {t(keyFor('application.items', entry.key, 'application.steps.documents')) + optional}
      </strong>
      {details.length > 0 && <span className="flow__muted">{details.join(' · ')}</span>}
    </>
  );
}

function PayoutSummary({ application }: Readonly<{ application: Application }>) {
  const { t } = useI18n();
  const { payout } = application;
  return (
    <p>
      {payout
        ? t('application.payoutOnFile', {
            method: t(`application.payoutMethod.${payout.method}`),
            hint: payout.hint,
            name: payout.holderName,
          })
        : t('application.review.notProvided')}
    </p>
  );
}

function SubmitPanel({ application, pending, onSubmit }: Readonly<Omit<Props, 'onEdit'>>) {
  const { t } = useI18n();
  const missingLabel = (key: string) =>
    key === 'identity' || key === 'payout'
      ? t(`application.missing.${key}`)
      : t(keyFor('application.items', key, 'application.steps.documents'));
  return (
    <>
      {application.missing.length > 0 && (
        <Notice tone="warning">
          <strong>{t('application.missingTitle')}</strong>
          <ul>
            {application.missing.map((key) => (
              <li key={key}>{missingLabel(key)}</li>
            ))}
          </ul>
        </Notice>
      )}
      <Button onClick={() => void onSubmit()} disabled={pending || application.missing.length > 0}>
        {t('application.submit')}
      </Button>
      <p className="flow__muted">{t('application.reviewTime')}</p>
    </>
  );
}
