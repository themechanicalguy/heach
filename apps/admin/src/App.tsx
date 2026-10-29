import { Skeleton } from '@heach/ui';
import { useState } from 'react';
import { t } from './i18n';
import { AdminLayout, type Section } from './layout/AdminLayout';
import { Dashboard } from './pages/Dashboard';
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
  const sections: Section[] = USER_READERS.has(role) ? ['dashboard', 'users'] : ['dashboard'];
  const current = sections.includes(section) ? section : 'dashboard';
  return (
    <AdminLayout sections={sections} current={current} onSection={setSection}>
      {current === 'users' ? <Users canChange={USER_CHANGERS.has(role)} /> : <Dashboard />}
    </AdminLayout>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
