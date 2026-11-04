import { CATALOGUES } from '@heach/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FooterSwitch } from './FooterSwitch';
import { AppFooter, SiteFooter } from './SiteFooter';

const state = vi.hoisted(() => ({ status: 'signed-out', pathname: '/en' }));
vi.mock('../../lib/session', () => ({ useSession: () => ({ status: state.status }) }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
afterEach(cleanup);

const footer = () =>
  render(
    <FooterSwitch
      full={<SiteFooter config={{}} locale="en" />}
      compact={<AppFooter config={{}} locale="en" />}
    />,
  );

it.each([
  ['signed-out', '/en', 'full'],
  ['checking', '/en/services/nursing', 'full'],
  ['signed-out', '/en/pages/privacy', 'full'],
  ['signed-in', '/en', 'compact'],
  ['signed-in', '/en/pages/privacy', 'compact'],
  ['signed-out', '/en/vault', 'compact'],
  ['checking', '/en/bookings/abc', 'compact'],
  ['signed-in', '/en/provider', 'compact'],
])('G14 %s on %s shows the %s footer', (status, pathname, kind) => {
  state.status = status;
  state.pathname = pathname;
  const { container } = footer();
  expect(container.querySelector('.site-footer--app') !== null).toBe(kind === 'compact');
});

it('G14 the compact footer keeps help and the legal pages, without a second language switch', () => {
  state.status = 'signed-in';
  state.pathname = '/en/vault';
  footer();
  const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
  expect(hrefs).toEqual([
    '/en/pages/contact',
    '/en/pages/terms',
    '/en/pages/privacy',
    '/en/pages/refunds',
    '/en/pages/grievance',
  ]);
  expect(screen.getByText(CATALOGUES.en.site.legalPending)).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
