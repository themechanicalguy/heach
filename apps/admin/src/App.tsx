import { Skeleton } from '@heach/ui';
import { useState } from 'react';
import { t } from './i18n';
import { AdminLayout, type Section } from './layout/AdminLayout';
import { Admins } from './pages/Admins';
import { Dashboard } from './pages/Dashboard';
import { OwnPassword } from './pages/OwnPassword';
import { SignIn } from './pages/SignIn';
import { Users } from './pages/Users';
import { SessionProvider, useSession } from './session';

/** Sub-roles that may see users, and that may change them (the API enforces the same, AD-03). */
const USER_READERS = new Set(['super_admin', 'support', 'verifier']);
const USER_CHANGERS = new Set(['super_admin', 'support']);

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
  if (USER_READERS.has(role)) sections.push('users');
  if (role === 'super_admin') sections.push('admins');
  sections.push('password');
  return sections;
}

function Page({
  section,
  role,
  selfId,
}: Readonly<{ section: Section; role: string; selfId: string | undefined }>) {
  if (section === 'users') return <Users canChange={USER_CHANGERS.has(role)} />;
  if (section === 'admins') return <Admins selfId={selfId} />;
  if (section === 'password') return <OwnPassword />;
  return <Dashboard />;
}

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
