'use client';

import { formatDate } from '@heach/i18n';
import { EmptyState } from '@heach/ui';
import type { ContentPage } from '@heach/types';
import { ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';

/** A static page edited by operations (AD-09), shown as plain paragraphs; no markup is rendered. */
export function ContentPageView({ slug }: Readonly<{ slug: string }>) {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<ContentPage>(`/pages/${slug}?locale=${locale}`);
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
                  {t('pages.updated', { time: formatDate(new Date(page.updatedAt), locale) })}
                </p>
              </>
            )}
          </ResourceView>
        )}
      </div>
    </section>
  );
}

export const PAGE_SLUGS = ['terms', 'privacy', 'faq', 'refunds'] as const;
