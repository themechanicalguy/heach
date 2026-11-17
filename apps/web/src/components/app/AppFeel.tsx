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

/** A web view has no address bar to show that a tap is loading a page, so the app shows a bar. */
function PageProgress() {
  const { t } = useI18n();
  const page = `${usePathname()}?${useSearchParams().toString()}`;
  const [leaving, setLeaving] = useState<string>();
  useEffect(() => {
    const onTap = (event: MouseEvent) => {
      if (leavesPage(tapOf(event), window.location.href)) setLeaving(page);
    };
    document.addEventListener('click', onTap);
    return () => {
      document.removeEventListener('click', onTap);
    };
  }, [page]);
  const loading = leaving === page;
  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => {
      setLeaving(undefined);
    }, GIVE_UP_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);
  if (!loading) return null;
  return <div className="app-progress" role="progressbar" aria-label={t('state.loading')} />;
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
