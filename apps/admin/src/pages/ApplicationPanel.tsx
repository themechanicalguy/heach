import { Button, ErrorState, Icon, Notice, Skeleton } from '@heach/ui';
import type { ApplicationReview } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { DecisionForm } from './DecisionForm';
import { DocumentRow } from './DocumentRow';
import { label } from './labels';
import { documentName, IdentityBadge, roleName, StatusBadge } from './status-badges';

interface Props {
  accountId: string;
  onDecided: () => void;
  onClose: () => void;
  /** Opens the focused document review, at a document when one was chosen. */
  onReview: (documentId?: string) => void;
}

/** Loads one application; opening it starts its review, recorded by the server (AD-02). */
export function useApplication(accountId: string) {
  const fetcher = useCallback(
    () => api<ApplicationReview>(`/applications/${accountId}`),
    [accountId],
  );
  return useLoad(fetcher);
}

const missingLabel = (key: string) =>
  key === 'identity' || key === 'payout' ? t(`verification.${key}`) : documentName(key);

/**
 * One application beside the queue (AD-02, G18): facts and documents scroll inside the panel,
 * and the decision stays at its foot, so it is always in reach.
 */
export function ApplicationPanel({ accountId, onDecided, onClose, onReview }: Readonly<Props>) {
  const { loaded, reload } = useApplication(accountId);
  const [decided, setDecided] = useState(false);
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  const application = loaded.value;
  const inReview = application.status === 'under_review';
  return (
    <aside className="admin-panel admin-panel--review" aria-label={t('verification.detailTitle')}>
      <div className="admin-panel__scroll">
        <PanelFacts application={application} onClose={onClose} />
        <p className="admin-note">
          <Icon name="lock" size={16} />
          {t('verification.auditNote')}
        </p>
        <Button
          className="heach-button--secondary heach-button--compact"
          onClick={() => {
            onReview();
          }}
        >
          {t('verification.reviewDocuments')}
          <Icon name="chevron-right" size={18} />
        </Button>
        <h3>{t('verification.documents')}</h3>
        <ul className="admin-docs">
          {application.items.map((entry) => (
            <DocumentRow
              key={entry.key}
              accountId={accountId}
              entry={entry}
              inReview={inReview}
              onReviewed={reload}
              onOpen={(document) => {
                onReview(document.id);
                return Promise.resolve();
              }}
            />
          ))}
        </ul>
        {application.missing.length > 0 && (
          <Notice tone="warning">
            {`${t('verification.missing')}: ${application.missing.map(missingLabel).join(', ')}`}
          </Notice>
        )}
        <History application={application} />
        {decided && (
          <Notice tone="success" live>
            {t('verification.decided')}
          </Notice>
        )}
      </div>
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
    </aside>
  );
}

/** Who applied, the status, the identity result and the payout account, compactly. */
function PanelFacts({
  application,
  onClose,
}: Readonly<{ application: ApplicationReview; onClose: () => void }>) {
  return (
    <>
      <header className="admin-panel__head">
        <span className="admin-avatar">
          <Icon name="user" size={22} />
        </span>
        <div>
          <h2>{application.fullName ?? t('verification.detailTitle')}</h2>
          <p className="admin-muted">{roleName(application.role)}</p>
        </div>
        <button
          type="button"
          className="admin-icon-button"
          aria-label={t('verification.close')}
          onClick={onClose}
        >
          <Icon name="chevron-right" size={20} />
        </button>
      </header>
      <dl className="admin-facts">
        <dt>{t('verification.status')}</dt>
        <dd>
          <StatusBadge status={application.status} />
        </dd>
        <dt>{t('verification.identity')}</dt>
        <dd>
          <IdentityBadge identity={application.identity} />
        </dd>
        <dt>{t('verification.payout')}</dt>
        <dd>
          {application.payout
            ? `${application.payout.method.toUpperCase()} …${application.payout.hint}`
            : t('verification.payoutNone')}
        </dd>
      </dl>
    </>
  );
}

/** The application's history, folded away so it never pushes the decision down (G18). */
export function History({ application }: Readonly<{ application: ApplicationReview }>) {
  return (
    <details className="admin-history">
      <summary>{t('verification.history')}</summary>
      <ol className="admin-list">
        {application.history.map((event) => (
          <li key={`${event.createdAt}-${event.toStatus}`}>
            {`${new Date(event.createdAt).toLocaleString('en-IN')}: ${label('verification.statuses', event.toStatus)} (${label('adminRoles', event.actorRole)})`}
          </li>
        ))}
      </ol>
    </details>
  );
}
