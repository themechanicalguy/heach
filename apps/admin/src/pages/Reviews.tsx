import { formatDate } from '@heach/i18n';
import { Button, EmptyState, ErrorState, Skeleton, Table } from '@heach/ui';
import type { AdminReview } from '@heach/types';
import { useCallback, useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { useLoad } from '../use-load';
import { usePending } from '../use-pending';
import { Choice } from './Tickets';
import en from '../../messages/en.json';

/** Reported reviews (RF-02): hide one with a recorded reason. */
export function Reviews() {
  const { loaded, reload } = useLoad(useCallback(() => api<AdminReview[]>('/reviews'), []));
  const [why, setWhy] = useState('abusive');
  const { pending, run } = usePending();
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error')
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  const hide = (id: string) =>
    run(async () => {
      await api(`/reviews/${id}/hide`, { method: 'POST', body: JSON.stringify({ reason: why }) });
      reload();
    });
  return (
    <>
      <h1>{t('reviews.title')}</h1>
      <p>{t('reviews.intro')}</p>
      <Choice
        label={t('reviews.reason')}
        value={why}
        onChange={setWhy}
        group="reviews.reasons"
        values={Object.keys(en.reviews.reasons)}
      />
      {loaded.value.length === 0 ? (
        <EmptyState message={t('reviews.empty')} />
      ) : (
        <Table
          caption={t('reviews.caption')}
          rows={loaded.value}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'stars',
              header: t('reviews.stars'),
              cell: (row: AdminReview) => String(row.stars),
            },
            {
              key: 'comment',
              header: t('reviews.comment'),
              cell: (row: AdminReview) =>
                `${row.comment ?? '—'} (${formatDate(new Date(row.createdAt), 'en')})`,
            },
            {
              key: 'hidden',
              header: t('reviews.hidden'),
              cell: (row: AdminReview) => t(row.hidden ? 'reviews.yes' : 'reviews.no'),
            },
            {
              key: 'hide',
              header: '',
              cell: (row: AdminReview) =>
                row.hidden ? null : (
                  <Button
                    className="heach-button--danger"
                    aria-label={`${t('reviews.hide')} ${row.id}`}
                    disabled={pending}
                    onClick={() => void hide(row.id)}
                  >
                    {t('reviews.hide')}
                  </Button>
                ),
            },
          ]}
        />
      )}
    </>
  );
}
