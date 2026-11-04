'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '../../lib/session';

// Public pages keep the site directory; everything else is an application task screen.
const PUBLIC_PAGES = /^\/[a-z]{2}(\/(services|pages|providers|sign-in|welcome)(\/|$)|\/?$)/;

/**
 * Chooses between the two server-rendered footers: the full directory on public pages while
 * signed out, the compact footer on task screens and once signed in (G14). Only the footer, the
 * last thing on the page, changes when the session is restored, so nothing above it moves.
 */
export function FooterSwitch({ full, compact }: Readonly<{ full: ReactNode; compact: ReactNode }>) {
  const { status } = useSession();
  const publicPage = PUBLIC_PAGES.test(usePathname());
  return publicPage && status !== 'signed-in' ? full : compact;
}
