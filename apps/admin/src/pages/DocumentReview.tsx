import { Button, ErrorState, Icon, Notice, Skeleton } from '@heach/ui';
import type { ApplicationReview, ChecklistEntry } from '@heach/types';
import { useEffect, useState } from 'react';
import { errorText, t } from '../i18n';
import { History, useApplication } from './ApplicationPanel';
import { DecisionForm } from './DecisionForm';
import { DocumentRow, openDocument } from './DocumentRow';
import { documentName, roleName } from './status-badges';

interface Props {
  accountId: string;
  documentId?: string | undefined;
  onBack: () => void;
  onDecided: () => void;
}

type Opened = { url: string; contentType: string } | undefined;

/**
 * Admin B (G18): one document large beside the checks and the decision. Each document is fetched
 * through the audited endpoint only when shown, and its local copy is dropped on leaving it.
 */
export function DocumentReview({ accountId, documentId, onBack, onDecided }: Readonly<Props>) {
  const { loaded, reload } = useApplication(accountId);
  // While a review or decision refreshes the application, keep showing the last one, so the
  // open document and its place stay put.
  const [last, setLast] = useState<ApplicationReview>();
  if (loaded.state === 'ready' && loaded.value !== last) setLast(loaded.value);
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  const application = loaded.state === 'ready' ? loaded.value : last;
  if (!application) return <Skeleton label={t('state.loading')} />;
  return (
    <Workspace
      application={application}
      start={documentId}
      onBack={onBack}
      onChanged={reload}
      onDecided={onDecided}
    />
  );
}

interface WorkspaceProps {
  application: ApplicationReview;
  start: string | undefined;
  onBack: () => void;
  onChanged: () => void;
  onDecided: () => void;
}

function Workspace({ application, start, onBack, onChanged, onDecided }: Readonly<WorkspaceProps>) {
  const files = application.items.filter((entry) => entry.document?.scanStatus === 'clean');
  const [current, setCurrent] = useState(
    files.find((entry) => entry.document?.id === start)?.key ?? files[0]?.key,
  );
  const [decided, setDecided] = useState(false);
  const entry = application.items.find((item) => item.key === current);
  const inReview = application.status === 'under_review';
  return (
    <section className="admin-review" aria-labelledby="admin-review-title">
      <header className="admin-review__bar">
        <Button className="heach-button--link" onClick={onBack}>
          <Icon name="chevron-left" size={18} />
          {t('verification.backToQueue')}
        </Button>
        <h1 id="admin-review-title">
          {application.fullName ?? t('verification.detailTitle')} · {roleName(application.role)}
        </h1>
      </header>
      <div className="admin-review__body">
        <div className="admin-review__viewer">
          <DocumentTabs files={files} current={current} onSelect={setCurrent} />
          {entry?.document && (
            <Viewer key={entry.key} accountId={application.accountId} entry={entry} />
          )}
        </div>
        <div className="admin-review__side">
          <div className="admin-review__checks">
            <p className="admin-note">
              <Icon name="lock" size={16} />
              {t('verification.auditNote')}
            </p>
            <ul className="admin-docs">
              {application.items
                .filter((item) => item.key === current || !item.document)
                .map((item) => (
                  <DocumentRow
                    key={item.key}
                    accountId={application.accountId}
                    entry={item}
                    inReview={inReview}
                    onReviewed={onChanged}
                  />
                ))}
            </ul>
            <History application={application} />
            {decided && (
              <Notice tone="success" live>
                {t('verification.decided')}
              </Notice>
            )}
          </div>
          {inReview && (
            <DecisionForm
              accountId={application.accountId}
              onDecided={() => {
                setDecided(true);
                onChanged();
                onDecided();
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function DocumentTabs({
  files,
  current,
  onSelect,
}: Readonly<{
  files: ChecklistEntry[];
  current: string | undefined;
  onSelect: (key: string) => void;
}>) {
  if (files.length === 0) return <p className="admin-muted">{t('verification.noDocument')}</p>;
  return (
    <div className="admin-review__tabs">
      {files.map((file, index) => (
        <button
          type="button"
          key={file.key}
          className="admin-chip"
          aria-pressed={file.key === current}
          aria-label={`${documentName(file.key)}, ${t('verification.documentPosition', { current: index + 1, total: files.length })}`}
          onClick={() => {
            onSelect(file.key);
          }}
        >
          {documentName(file.key)}
        </button>
      ))}
    </div>
  );
}

/** The document itself: images and PDFs inline, anything else as a link to a new tab. */
function Viewer({ accountId, entry }: Readonly<{ accountId: string; entry: ChecklistEntry }>) {
  const [opened, setOpened] = useState<Opened>();
  const [error, setError] = useState<unknown>();
  const id = entry.document?.id;
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    let url: string | undefined;
    openDocument(accountId, id).then(
      (file) => {
        url = file.url;
        if (cancelled) URL.revokeObjectURL(file.url);
        else setOpened(file);
      },
      (caught: unknown) => {
        if (!cancelled) setError(caught ?? new Error('failed'));
      },
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [accountId, id]);
  const name = documentName(entry.key);
  if (error !== undefined) return <Notice tone="danger">{errorText(error)}</Notice>;
  if (!opened) return <Skeleton label={t('state.loading')} />;
  if (opened.contentType.startsWith('image/'))
    return <img className="admin-review__document" src={opened.url} alt={name} />;
  if (opened.contentType === 'application/pdf')
    return <iframe className="admin-review__document" src={opened.url} title={name} />;
  return (
    <p>
      {t('verification.noPreview')}{' '}
      <a href={opened.url} target="_blank" rel="noreferrer">
        {t('verification.openInTab')}
      </a>
    </p>
  );
}
