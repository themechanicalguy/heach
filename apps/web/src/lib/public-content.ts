import type { ContentPage, ServicePrice } from '@heach/types';
import { CATALOGUES, type Locale } from '@heach/i18n';

/** Server-side public content only. No cookies, account identifiers or secrets are forwarded. */
export async function publicContent(
  slug: ContentPage['slug'],
  locale: Locale,
): Promise<ContentPage> {
  const draft = CATALOGUES[locale].sitePages[slug];
  const fallback = { slug, locale, ...draft, updatedAt: null };
  const origin = process.env.API_ORIGIN;
  if (!origin) return fallback;
  try {
    const response = await fetch(`${origin}/v1/pages/${slug}?locale=${locale}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) return (await response.json()) as ContentPage;
  } catch {
    // Drafts are explicitly labelled; never invent approved operational details on a failure.
  }
  return fallback;
}

/** Published public prices for a visible service page; no session information is forwarded. */
export async function publicPrices(): Promise<ServicePrice[]> {
  if (!process.env.API_ORIGIN) return [];
  try {
    const response = await fetch(`${process.env.API_ORIGIN}/v1/service-prices`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? ((await response.json()) as ServicePrice[]) : [];
  } catch {
    return [];
  }
}
