'use client';

import { Button, Card, Notice } from '@heach/ui';
import type { Me } from '@heach/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from '../../lib/account';
import { useI18n } from '../../lib/i18n-context';
import { destinationFor, isOrganisationOwner } from '../../lib/routing';
import { useSession } from '../../lib/session';
import { usePending } from '../../lib/use-pending';
import { AddRole } from './AddRole';
import { PAGE_SLUGS } from '../content/ContentPageView';
import { DataRights } from './DataRights';
import { Invitations } from './Invitations';
import { MobileChange } from './MobileChange';
import { ProfileSection } from './ProfileSection';

/**
 * Account details, roles and role switching, and sign-out of one or every device (AC-05, SE-07).
 * A role deferred beyond the MVP (ADR 0015) is listed as kept but not offered, with no switch.
 */
export function AccountView({ me }: Readonly<{ me: Me }>) {
  const { t } = useI18n();
  const router = useRouter();
  const { switchRole } = useAccount();
  const [switched, setSwitched] = useState<string | undefined>();
  const [added, setAdded] = useState(false);
  const { pending, error, run } = usePending();
  const usable = me.activeRole !== 'new_account';
  const roleName = (role: string) => t(`roles.${role as Me['activeRole']}.name`);

  const chooseRole = (role: string) =>
    run(async () => {
      const next = await switchRole(role);
      setSwitched(roleName(role));
      router.push(destinationFor(next));
    });

  return (
    <section className="flow" aria-labelledby="account-title">
      <div className="flow__card">
        <h1 id="account-title" className="flow__title">
          {t('account.title')}
        </h1>
        <dl className="facts">
          <dt>{t('account.mobile')}</dt>
          <dd>{me.mobile ?? '—'}</dd>
          <dt>{t('account.language')}</dt>
          <dd lang={me.locale}>{t(`locale.${me.locale}`)}</dd>
        </dl>
        <h2 className="flow__subtitle">{t('account.rolesTitle')}</h2>
        {me.activeRole === 'new_account' && (
          <Notice tone="warning">{t('account.noUsableRole')}</Notice>
        )}
        <ul className="role-list">
          {me.roles.map((grant) => (
            <li key={grant.role}>
              <Card title={t(`roles.${grant.role}.label`)}>
                <RoleAction
                  grant={grant}
                  active={grant.role === me.activeRole}
                  disabled={pending}
                  onSwitch={() => void chooseRole(grant.role)}
                />
              </Card>
            </li>
          ))}
        </ul>
        {switched && (
          <Notice tone="success" live>
            {t('account.switched', { role: switched })}
          </Notice>
        )}
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
      </div>
      {added && (
        <Notice tone="success" live>
          {t('account.roleAdded')}
        </Notice>
      )}
      <AccountLinks me={me} />
      <Invitations />
      {/* With no role it may use (ADR 0015), the account first adds one: the API refuses these. */}
      {usable && <ProfileSection me={me} />}
      {usable && <MobileChange />}
      {me.roles.length < 2 && (
        <AddRole
          me={me}
          onAdded={() => {
            setAdded(true);
          }}
        />
      )}
      {usable && <DataRights me={me} />}
      <AboutLinks />
      <SignOutCard />
    </section>
  );
}

/** What a role's card offers: the role in use, a switch to it, or why it cannot be used. */
function RoleAction({
  grant,
  active,
  disabled,
  onSwitch,
}: Readonly<{
  grant: Me['roles'][number];
  active: boolean;
  disabled: boolean;
  onSwitch: () => void;
}>) {
  const { t } = useI18n();
  if (active) return <p className="role-list__active">{t('account.using')}</p>;
  if (!grant.available) return <p className="flow__muted">{t('account.roleUnavailable')}</p>;
  return (
    <Button className="heach-button--secondary" disabled={disabled} onClick={onSwitch}>
      {t('account.switchTo', { role: t(`roles.${grant.role}.name`) })}
    </Button>
  );
}

/** Pages for the people this account books for, and for a lab's or clinic's staff. */
function AccountLinks({ me }: Readonly<{ me: Me }>) {
  const { locale, t } = useI18n();
  const usable = me.roles.filter((grant) => grant.available);
  const care = usable.some((grant) => grant.side === 'care');
  const owner = usable.some((grant) => isOrganisationOwner(grant.role));
  if (!care && !owner) return null;
  return (
    <nav className="flow__card" aria-label={t('account.linksLabel')}>
      {care && (
        <Link className="heach-button heach-button--secondary" href={`/${locale}/people`}>
          {t('people.title')}
        </Link>
      )}
      {owner && (
        <Link className="heach-button heach-button--secondary" href={`/${locale}/team`}>
          {t('team.title')}
        </Link>
      )}
    </nav>
  );
}

/** Sign out of this device, or of every device (SE-07). */
function SignOutCard() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { signOut, signOutAll } = useSession();
  const { pending, run } = usePending();
  const leave = (everywhere: boolean) =>
    run(async () => {
      await (everywhere ? signOutAll() : signOut());
      router.replace(`/${locale}/sign-in`);
    });
  return (
    <div className="flow__card">
      <Button
        className="heach-button--secondary"
        disabled={pending}
        onClick={() => void leave(false)}
      >
        {t('account.signOut')}
      </Button>
      <p className="flow__muted">{t('account.signOutAllHint')}</p>
      <Button className="heach-button--danger" disabled={pending} onClick={() => void leave(true)}>
        {t('account.signOutAll')}
      </Button>
    </div>
  );
}

/** Terms, privacy, questions and refunds, edited by operations (AD-09). */
function AboutLinks() {
  const { locale, t } = useI18n();
  return (
    <nav className="flow__card" aria-label={t('pages.links')}>
      <h2 className="flow__subtitle">{t('pages.links')}</h2>
      <ul>
        {PAGE_SLUGS.map((slug) => (
          <li key={slug}>
            <Link href={`/${locale}/pages/${slug}`}>{t(`pages.${slug}`)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
