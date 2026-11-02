'use client';

import { formatDate } from '@heach/i18n';
import { EmptyState } from '@heach/ui';
import type { ContentPage } from '@heach/types';
import { ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

/** A static page edited by operations (AD-09), shown as plain paragraphs; no markup is rendered. */
export function ContentPageView({
  slug,
  initial,
}: Readonly<{ slug: string; initial?: ContentPage }>) {
  const { locale, t } = useI18n();
  const loaded = useResource<ContentPage>(`/pages/${slug}?locale=${locale}`, undefined, !initial);
  const { reload } = loaded;
  const resource = initial ? { state: 'ready' as const, data: initial } : loaded.resource;
  return (
    <section className="flow" aria-labelledby="page-title">
      <div className="flow__card">
        {resource.state === 'error' &&
        resource.error instanceof ApiError &&
        resource.error.status === 404 ? (
          <EmptyState message={t('pages.notFound')} />
        ) : (
          <ResourceView resource={resource} reload={reload}>
            {(page) => (
              <>
                <h1 id="page-title" className="flow__title">
                  {page.title}
                </h1>
                {page.body.split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={String(index)}>{paragraph}</p>
                ))}
                <p className="flow__muted">
                  {page.updatedAt
                    ? t('pages.updated', { time: formatDate(new Date(page.updatedAt), locale) })
                    : t('pages.draft')}
                </p>
              </>
            )}
          </ResourceView>
        )}
      </div>
    </section>
  );
}

export { PAGE_SLUGS } from '@heach/i18n';
