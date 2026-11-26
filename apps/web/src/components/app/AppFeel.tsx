'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { leavesPage, showPage } from '../../lib/app-feel';
import { useI18n } from '../../lib/i18n-context';

/** A page that has not arrived by now is not coming; the bar must not run for ever. */
const GIVE_UP_MS = 15_000;

function tapOf(event: MouseEvent) {
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
  return {
    href: link?.getAttribute('href') ?? undefined,
    elsewhere: modified || link?.target === '_blank' || link?.hasAttribute('download') === true,
  };
}

/** The bar from a tap on a link until this part is replaced by the next page's. */
function ProgressFromTap() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const onTap = (event: MouseEvent) => {
      if (leavesPage(tapOf(event), window.location.href)) setLoading(true);
    };
    document.addEventListener('click', onTap);
    return () => {
      document.removeEventListener('click', onTap);
    };
  }, []);
  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => {
      setLoading(false);
    }, GIVE_UP_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);
  if (!loading) return null;
  return <div className="app-progress" role="progressbar" aria-label={t('state.loading')} />;
}

/**
 * A web view has no address bar to show that a tap is loading a page, so the app shows a bar.
 * Keyed by the page: arriving anywhere, forwards or back, starts with no bar.
 */
function PageProgress() {
  const page = `${usePathname()}?${useSearchParams().toString()}`;
  return <ProgressFromTap key={page} />;
}

/** What only the Android apps need to feel like apps (MA-09); never rendered in a browser. */
export function AppFeel() {
  // Rendered after hydration, so the launch screen lifts on a page that already answers taps.
  useEffect(showPage, []);
  return (
    <Suspense>
      <PageProgress />
    </Suspense>
  );
}
