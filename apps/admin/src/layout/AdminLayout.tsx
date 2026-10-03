import type { ReactNode } from 'react';
import { t } from '../i18n';
import './admin-layout.css';

const NAV_ITEMS = ['dashboard', 'verification', 'bookings', 'finance'] as const;

export function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin">
      <a className="admin__skip" href="#main">
        {t('app.skipToContent')}
      </a>
      <aside className="admin__sidebar">
        <p className="admin__brand">{t('app.name')}</p>
        <nav aria-label={t('app.navLabel')}>
          <ul className="admin__nav">
            {NAV_ITEMS.map((item) => (
              <li key={item}>
                {/* Inert placeholders until routing is chosen. */}
                <a aria-disabled="true">{t(`nav.${item}`)}</a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main id="main" className="admin__content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
