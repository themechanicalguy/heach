'use client';

import type { LinkedPatient } from '@heach/types';
import { useAccount } from '../../lib/account';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/use-resource';
import { isCareRole } from '../../lib/routing';
import { SERVICES } from '../care/services';

function PersonPicker() {
  const { locale, t } = useI18n();
  const { resource } = useResource<LinkedPatient[]>('/me/linked-patients');
  const { person, setPerson } = useCareSearch();
  const people = resource.state === 'ready' ? resource.data : [];
  return (
    <details className="header-care">
      <summary className="header-pill">
        {people.find((row) => row.id === person)?.fullName ?? t('site.forMe')}
      </summary>
      <div className="header-care__menu">
        <label className="heach-field">
          <span>{t('vault.person')}</span>
          <select
            className="heach-input"
            value={person}
            onChange={(event) => {
              setPerson(event.currentTarget.value);
            }}
          >
            <option value="">{t('site.forMe')}</option>
            {people.map((row) => (
              <option key={row.id} value={row.id}>
                {row.fullName}
              </option>
            ))}
          </select>
        </label>
        <a className="site-link" href={`/${locale}/people`}>
          {t('people.title')}
        </a>
      </div>
    </details>
  );
}

export function HeaderCare() {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const { enabled, account } = useAccount();
  if (enabled && status === 'signed-in')
    return (
      <>
        {account.state === 'ready' && isCareRole(account.me.activeRole) && <PersonPicker />}
        <details className="header-care">
          <summary className="header-pill">{t('site.more')}</summary>
          <nav className="header-care__menu" aria-label={t('site.more')}>
            <a className="site-link" href={`/${locale}/plans`}>
              {t('nav.plans')}
            </a>
            <a className="site-link" href={`/${locale}/notifications`}>
              {t('nav.notifications')}
            </a>
          </nav>
        </details>
      </>
    );
  return (
    <details className="header-care">
      <summary className="header-pill">{t('site.services')}</summary>
      <ul className="header-care__menu">
        {SERVICES.map((service) => (
          <li key={service}>
            <a className="site-link" href={`/${locale}/services/${service}`}>
              {t(`services.${service}`)}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
