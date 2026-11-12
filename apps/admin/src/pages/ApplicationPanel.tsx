import { Button, ErrorState, Notice, Skeleton } from '@heach/ui';
import type { ApplicationReview, ChecklistEntry } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { DecisionForm } from './DecisionForm';
import { IdentityDocumentRow } from './IdentityDocumentRow';
import { label } from './labels';
import { ReviewButtons } from './ReviewButtons';
import { StoredFileButton } from './StoredFileButton';

interface Props {
  accountId: string;
  onDecided: () => void;
  onClose: () => void;
}

/** One application under review (AD-02): identity, documents, payout, history, decision. */
export function ApplicationPanel({ accountId, onDecided, onClose }: Readonly<Props>) {
  const fetcher = useCallback(
    () => api<ApplicationReview>(`/applications/${accountId}`),
    [accountId],
  );
  const { loaded, reload } = useLoad(fetcher);
  const [decided, setDecided] = useState(false);
  if (loaded.state === 'error') {
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  }
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  const application = loaded.value;
  const inReview = application.status === 'under_review';
  return (
    <aside className="admin-panel" aria-label={t('verification.detailTitle')}>
      <h2>{application.fullName ?? t('verification.detailTitle')}</h2>
      <dl className="admin-facts">
        <dt>{t('verification.role')}</dt>
        <dd>{application.role}</dd>
        <dt>{t('verification.status')}</dt>
        <dd>{label('verification.statuses', application.status)}</dd>
        <dt>{t('verification.identity')}</dt>
        <dd>{label('verification.identityStates', application.identity)}</dd>
        {application.identityMethod && (
          <>
            <dt>{t('verification.identityMethod')}</dt>
            <dd>{label('verification.identityMethods', application.identityMethod)}</dd>
          </>
        )}
        {application.identityNameMatch && (
          <>
            <dt>{t('verification.nameMatch')}</dt>
            <dd>{label('verification.nameMatches', application.identityNameMatch)}</dd>
          </>
        )}
        <dt>{t('verification.payout')}</dt>
        <dd>
          {application.payout
            ? `${application.payout.method} …${application.payout.hint}`
            : t('verification.payoutNone')}
        </dd>
      </dl>
      {application.identityNameMatch === 'mismatch' && (
        <Notice tone="warning">{t('verification.nameMismatch')}</Notice>
      )}
      <IdentityDocumentRow accountId={accountId} application={application} onReviewed={reload} />
      <h3>{t('verification.documents')}</h3>
      <ul className="admin-list">
        {application.items.map((entry) => (
          <DocumentRow
            key={entry.key}
            accountId={accountId}
            entry={entry}
            inReview={inReview}
            onReviewed={reload}
          />
        ))}
      </ul>
      {application.missing.length > 0 && (
        <Notice tone="warning">{`${t('verification.missing')}: ${application.missing.join(', ')}`}</Notice>
      )}
      <h3>{t('verification.history')}</h3>
      <ol className="admin-list">
        {application.history.map((event) => (
          <li key={`${event.createdAt}-${event.toStatus}`}>
            {`${new Date(event.createdAt).toLocaleString('en-IN')}: ${label('verification.statuses', event.toStatus)} (${event.actorRole})`}
          </li>
        ))}
      </ol>
      {decided && (
        <Notice tone="success" live>
          {t('verification.decided')}
        </Notice>
      )}
      {inReview && (
        <DecisionForm
          accountId={accountId}
          onDecided={() => {
            setDecided(true);
            reload();
            onDecided();
          }}
        />
      )}
      <Button className="heach-button--secondary" onClick={onClose}>
        {t('verification.close')}
      </Button>
    </aside>
  );
}

interface RowProps {
  accountId: string;
  entry: ChecklistEntry;
  inReview: boolean;
  onReviewed: () => void;
}

function DocumentRow({ accountId, entry, inReview, onReviewed }: Readonly<RowProps>) {
  const { pending, error, run } = usePending();
  const document = entry.document;
  const optional = entry.required ? '' : ` (${t('verification.optional')})`;
  const title = entry.key + optional;
  if (!document) return <li>{`${title}: ${t('verification.noDocument')}`}</li>;
  const review = (status: 'accepted' | 'rejected') =>
    void run(async () => {
      const body = {
        documentId: document.id,
        status,
        ...(status === 'rejected' ? { reason: 'documents_unclear' } : {}),
      };
      await api(`/applications/${accountId}/documents`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onReviewed();
    });
  const facts = [
    label('verification.scan', document.scanStatus),
    label('verification.review', document.reviewStatus),
    document.reference ? `${t('verification.reference')} ${document.reference}` : '',
    document.expiresOn ? `${t('verification.expires')} ${document.expiresOn}` : '',
  ].filter(Boolean);
  return (
    <li>
      <strong>{title}</strong> {facts.join(' · ')}
      {document.scanStatus === 'clean' && (
        <StoredFileButton path={`/applications/${accountId}/documents/${document.id}`} />
      )}
      {inReview && <ReviewButtons pending={pending} onReview={review} />}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
    </li>
  );
}
