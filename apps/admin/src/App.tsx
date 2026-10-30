import { Skeleton } from '@heach/ui';
import { type ReactNode, useState } from 'react';
import { t } from './i18n';
import { AdminLayout, type Section } from './layout/AdminLayout';
import { Admins } from './pages/Admins';
import { Applications } from './pages/Applications';
import { Bookings } from './pages/Bookings';
import { Catalogue } from './pages/Catalogue';
import { Content } from './pages/Content';
import { Finance } from './pages/Finance';
import { Labs } from './pages/Labs';
import { Plans } from './pages/Plans';
import { Referrals } from './pages/Referrals';
import { Security } from './pages/Security';
import { Settings } from './pages/Settings';
import { Reviews } from './pages/Reviews';
import { Tickets } from './pages/Tickets';
import { Vault } from './pages/Vault';
import { Dashboard } from './pages/Dashboard';
import { OwnPassword } from './pages/OwnPassword';
import { SignIn } from './pages/SignIn';
import { Users } from './pages/Users';
import { SessionProvider, useSession } from './session';

/** Sub-roles that may see users, and that may change them (the API enforces the same, AD-03). */
const USER_READERS = new Set(['super_admin', 'support', 'verifier']);
const USER_CHANGERS = new Set(['super_admin', 'support']);
const VERIFIERS = new Set(['super_admin', 'verifier']);

function Shell() {
  const { state } = useSession();
  const [section, setSection] = useState<Section>('dashboard');
  if (state.status === 'checking') return <Skeleton label={t('state.loading')} />;
  if (state.status === 'signed-out') return <SignIn />;
  const role = state.me.role;
  const sections = sectionsFor(role);
  const current = sections.includes(section) ? section : 'dashboard';
  return (
    <AdminLayout sections={sections} current={current} onSection={setSection}>
      <Page section={current} role={role} selfId={state.me.id} />
    </AdminLayout>
  );
}

/** The sections a sub-role sees; the API enforces the same on every request (AD-01). */
function sectionsFor(role: string): Section[] {
  const sections: Section[] = ['dashboard'];
  if (VERIFIERS.has(role)) sections.push('verification');
  if (['super_admin', 'support', 'finance'].includes(role)) sections.push('bookings');
  if (role === 'super_admin' || role === 'finance') sections.push('finance');
  if (role === 'super_admin' || role === 'support')
    sections.push('tickets', 'reviews', 'labs', 'vault');
  if (['super_admin', 'support', 'finance'].includes(role)) sections.push('plans');
  if (role === 'super_admin' || role === 'support') sections.push('referrals', 'catalogue');
  if (['super_admin', 'support', 'finance'].includes(role)) sections.push('settings');
  if (role === 'super_admin' || role === 'support') sections.push('content');
  if (role === 'super_admin') sections.push('security');
  if (USER_READERS.has(role)) sections.push('users');
  if (role === 'super_admin') sections.push('admins');
  sections.push('password');
  return sections;
}

interface PageProps {
  role: string;
  selfId: string | undefined;
}

/** Each section's page; the API checks the sub-role again on every request (AD-01). */
const PAGES: Record<Section, (props: PageProps) => ReactNode> = {
  dashboard: () => <Dashboard />,
  verification: () => <Applications />,
  bookings: ({ role }) => <Bookings role={role} />,
  finance: () => <Finance />,
  tickets: () => <Tickets />,
  reviews: () => <Reviews />,
  labs: () => <Labs />,
  vault: () => <Vault />,
  plans: ({ role }) => <Plans canChange={role === 'super_admin'} />,
  referrals: () => <Referrals />,
  settings: ({ role }) => <Settings canChange={role === 'super_admin'} />,
  security: () => <Security />,
  content: ({ role }) => <Content canChange={role === 'super_admin'} />,
  catalogue: ({ role }) => <Catalogue canChange={role === 'super_admin'} />,
  users: ({ role }) => <Users canChange={USER_CHANGERS.has(role)} />,
  admins: ({ selfId }) => <Admins selfId={selfId} />,
  password: () => <OwnPassword />,
};

function Page({ section, role, selfId }: Readonly<PageProps & { section: Section }>) {
  return <>{PAGES[section]({ role, selfId })}</>;
}

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
