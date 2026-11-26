import { Button } from '@heach/ui';
import { t } from '../i18n';

interface Props {
  pending: boolean;
  onReview: (status: 'accepted' | 'rejected') => void;
}

/** Accept and Reject for one document under review. */
export function ReviewButtons({ pending, onReview }: Readonly<Props>) {
  return (
    <>
      <Button
        onClick={() => {
          onReview('accepted');
        }}
        disabled={pending}
      >
        {t('verification.accept')}
      </Button>
      <Button
        className="heach-button--danger"
        onClick={() => {
          onReview('rejected');
        }}
        disabled={pending}
      >
        {t('verification.reject')}
      </Button>
    </>
  );
}
