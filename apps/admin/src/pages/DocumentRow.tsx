import { Badge, Button, Notice } from '@heach/ui';
import type { ChecklistEntry } from '@heach/types';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { label } from './labels';
import { documentName } from './status-badges';

type Document = NonNullable<ChecklistEntry['document']>;

const REVIEW_TONE = { pending: 'neutral', accepted: 'success', rejected: 'danger' } as const;
const SCAN_TONE = { pending: 'warning', clean: 'info', infected: 'danger' } as const;

/** Fetches one document through the audited endpoint (AD-02) as a local blob URL. */
export async function openDocument(accountId: string, documentId: string) {
  const file = await api<{ contentType: string; contentBase64: string }>(
    `/applications/${accountId}/documents/${documentId}`,
  );
  const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
  return {
    url: URL.createObjectURL(new Blob([bytes], { type: file.contentType })),
    contentType: file.contentType,
  };
}

export function DocumentBadges({ document }: Readonly<{ document: Document }>) {
  return (
    <span className="admin-badges">
      <Badge tone={SCAN_TONE[document.scanStatus]}>
        {label('verification.scan', document.scanStatus)}
      </Badge>
      <Badge tone={REVIEW_TONE[document.reviewStatus]}>
        {label('verification.review', document.reviewStatus)}
      </Badge>
    </span>
  );
}

interface Props {
  accountId: string;
  entry: ChecklistEntry;
  inReview: boolean;
  onReviewed: () => void;
  /** Opens the document in the focused review; absent where the document is already shown. */
  onOpen?: ((document: Document) => Promise<void>) | undefined;
}

/** One checklist document: its name, number and expiry, badges, and accept or reject. */
export function DocumentRow({ accountId, entry, inReview, onReviewed, onOpen }: Readonly<Props>) {
  const { pending, error, run } = usePending();
  const document = entry.document;
  const optional = entry.required ? '' : ` (${t('verification.optional')})`;
  const name = documentName(entry.key) + optional;
  if (!document)
    return (
      <li className="admin-doc">
        <strong>{name}</strong>
        <Badge tone="warning">{t('verification.noDocument')}</Badge>
      </li>
    );
  const review = (status: 'accepted' | 'rejected') =>
    run(async () => {
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
    document.reference ? `${t('verification.reference')} ${document.reference}` : '',
    document.expiresOn ? `${t('verification.expires')} ${document.expiresOn}` : '',
  ].filter(Boolean);
  return (
    <li className="admin-doc">
      <strong>{name}</strong>
      <DocumentBadges document={document} />
      {facts.length > 0 && <span className="admin-muted">{facts.join(' · ')}</span>}
      <span className="admin-actions">
        {onOpen && document.scanStatus === 'clean' && (
          <Button
            className="heach-button--secondary heach-button--compact"
            onClick={() => void run(() => onOpen(document))}
            disabled={pending}
          >
            {t('verification.download')}
          </Button>
        )}
        {inReview && (
          <>
            <Button
              className="heach-button--compact"
              onClick={() => void review('accepted')}
              disabled={pending}
            >
              {t('verification.accept')}
            </Button>
            <Button
              className="heach-button--danger heach-button--compact"
              onClick={() => void review('rejected')}
              disabled={pending}
            >
              {t('verification.reject')}
            </Button>
          </>
        )}
      </span>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
    </li>
  );
}
