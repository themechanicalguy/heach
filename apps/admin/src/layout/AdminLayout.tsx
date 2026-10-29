import { Button } from '@heach/ui';
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { useSession } from '../session';
import './admin-layout.css';

export type Section =
  | 'dashboard'
  | 'verification'
  | 'bookings'
  | 'finance'
  | 'tickets'
  | 'reviews'
  | 'labs'
  | 'vault'
  | 'catalogue'
  | 'users'
  | 'admins'
  | 'password';

interface Props {
  sections: readonly Section[];
  current: Section;
  onSection: (section: Section) => void;
  children: ReactNode;
}

/** Desktop-first shell (design reference, admin A): dark sidebar with the sections the role has. */
export function AdminLayout({ sections, current, onSection, children }: Readonly<Props>) {
  const { state, signOut } = useSession();
  return (
    <div className="admin">
      <a className="admin__skip" href="#main">
        {t('app.skipToContent')}
      </a>
      <aside className="admin__sidebar">
        <p className="admin__brand">{t('app.name')}</p>
        {state.status === 'signed-in' && (
          <p className="admin__who">
            {state.me.email}
            <br />
            {t(`adminRoles.${state.me.role as 'super_admin'}`)}
          </p>
        )}
        <nav aria-label={t('app.navLabel')}>
          <ul className="admin__nav">
            {sections.map((section) => (
              <li key={section}>
                <button
                  type="button"
                  aria-current={section === current ? 'page' : undefined}
                  onClick={() => {
                    onSection(section);
                  }}
                >
                  {t(`nav.${section}`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <Button className="heach-button--ghost admin__sign-out" onClick={() => void signOut()}>
          {t('nav.signOut')}
        </Button>
      </aside>
      <main id="main" className="admin__content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
