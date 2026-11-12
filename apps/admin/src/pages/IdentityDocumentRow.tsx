import { Notice } from '@heach/ui';
import type { ApplicationReview } from '@heach/types';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { label } from './labels';
import { ReviewButtons } from './ReviewButtons';
import { StoredFileButton } from './StoredFileButton';

interface Props {
  accountId: string;
  application: ApplicationReview;
  onReviewed: () => void;
}

/** The fallback identity document (KY-07): open it, then accept or reject the identity. */
export function IdentityDocumentRow({ accountId, application, onReviewed }: Readonly<Props>) {
  const { pending, error, run } = usePending();
  const kind = application.identityDocumentKind;
  if (!kind) return null;
  const review = (status: 'accepted' | 'rejected') =>
    void run(async () => {
      await api(`/applications/${accountId}/identity`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      onReviewed();
    });
  const waiting = application.status === 'under_review' && application.identity === 'in_review';
  return (
    <p>
      <strong>{t('verification.identityDocument')}</strong>{' '}
      {label('verification.identityKinds', kind)}
      <StoredFileButton path={`/applications/${accountId}/identity-document`} />
      {waiting && <ReviewButtons pending={pending} onReview={review} />}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
    </p>
  );
}
