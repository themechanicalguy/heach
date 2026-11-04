'use client';

import type { LinkedPatient } from '@heach/types';
import { Icon } from '@heach/ui';
import type { ReactNode } from 'react';
import { useAccount } from '../../lib/account';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/use-resource';
import { isCareRole } from '../../lib/routing';
import { SERVICES } from '../care/services';
import { SignOutButton } from '../HeaderAccount';
import { HeaderMenu } from '../HeaderMenu';

/** Who the care is for (design reference: the "For me" pill); search and booking follow it. */
function PersonPicker() {
  const { locale, t } = useI18n();
  const { resource } = useResource<LinkedPatient[]>('/me/linked-patients');
  const { person, setPerson } = useCareSearch();
  const people = resource.state === 'ready' ? resource.data : [];
  return (
    <HeaderMenu
      className="header-person"
      icon="user"
      chevron
      label={people.find((row) => row.id === person)?.fullName ?? t('site.forMe')}
    >
      <label className="heach-field">
        <span className="heach-field__label">{t('vault.person')}</span>
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
      <a className="header-menu__item" href={`/${locale}/people`}>
        <Icon name="users" size={20} />
        {t('people.title')}
      </a>
    </HeaderMenu>
  );
}

function HelpItem() {
  const { locale, t } = useI18n();
  return (
    <a className="header-menu__item" href={`/${locale}/pages/contact`}>
      <Icon name="phone" size={20} />
      {t('site.helpLink')}
    </a>
  );
}

/** Signed in: the bell and an account menu with the less frequent actions (G01). */
function SignedInActions({ care, language }: Readonly<{ care: boolean; language: ReactNode }>) {
  const { locale, t } = useI18n();
  return (
    <>
      {care && <PersonPicker />}
      {language}
      <a
        className="header-pill header-pill--icon"
        href={`/${locale}/notifications`}
        aria-label={t('nav.notifications')}
      >
        <Icon name="bell" size={20} />
      </a>
      <HeaderMenu icon="menu" label={t('site.more')} labelFrom="tablet">
        <nav aria-label={t('site.more')}>
          {care && (
            <a className="header-menu__item" href={`/${locale}/plans`}>
              <Icon name="calendar" size={20} />
              {t('nav.plans')}
            </a>
          )}
          <HelpItem />
          <SignOutButton />
        </nav>
      </HeaderMenu>
    </>
  );
}

/** The header's actions in reading order: who for, language, alerts, menu (design reference). */
export function HeaderCare({ language }: Readonly<{ language: ReactNode }>) {
  const { locale, t } = useI18n();
  const { status } = useSession();
  const { account } = useAccount();
  if (status === 'signed-in')
    return (
      <SignedInActions
        care={account.state === 'ready' && isCareRole(account.me.activeRole)}
        language={language}
      />
    );
  return (
    <>
      {language}
      <HeaderMenu icon="menu" label={t('site.services')} labelFrom="phone">
        <nav aria-label={t('site.services')}>
          {SERVICES.map((service) => (
            <a key={service} className="header-menu__item" href={`/${locale}/services/${service}`}>
              <Icon name={service === 'nursing' ? 'nurse' : service} size={20} />
              {t(`services.${service}`)}
            </a>
          ))}
          <HelpItem />
        </nav>
      </HeaderMenu>
    </>
  );
}
