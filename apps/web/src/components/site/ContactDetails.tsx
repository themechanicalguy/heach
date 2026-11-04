import { Notice } from '@heach/ui';
import type { ReactNode } from 'react';
import { translatorFor } from '../../i18n/messages';
import type { SiteConfig } from '../../lib/site-config';
import { ContactAction } from './ContactAction';
import { CopyValue } from './CopyValue';

type Props = Readonly<{ config: SiteConfig; locale: string }>;

function CopyNumber({ value, locale }: Readonly<{ value: string; locale: string }>) {
  const { t } = translatorFor(locale);
  return (
    <CopyValue value={value} label={t('contact.copyNumber')} copiedLabel={t('contact.copied')} />
  );
}

/** One labelled value; contact values stay visible as text beside any tel: or mailto: link. */
function Detail({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Block({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section className="site-section contact-block" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export function ContactChannels({ config, locale }: Props) {
  const { t } = translatorFor(locale);
  const { helpline, helplineHours, helplineLanguages, replyDays, supportEmail } = config;
  return (
    <Block id="contact-channels" title={t('contact.talkTitle')}>
      {helpline && (
        <div className="contact-actions">
          <ContactAction config={config} locale={locale} />
          <CopyNumber value={helpline} locale={locale} />
        </div>
      )}
      {!helpline && !supportEmail && <Notice tone="warning">{t('contact.channelsPending')}</Notice>}
      <dl className="contact-details">
        {helpline && helplineHours && (
          <Detail label={t('contact.hours')}>
            {t('contact.hoursValue', { ...helplineHours })}
          </Detail>
        )}
        {helpline && helplineLanguages && (
          <Detail label={t('contact.languages')}>
            {helplineLanguages.map((code) => t(`languages.${code}`)).join(' · ')}
          </Detail>
        )}
        {supportEmail && (
          <Detail label={t('contact.email')}>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </Detail>
        )}
      </dl>
      {replyDays && supportEmail && <p>{t('contact.reply', { days: replyDays })}</p>}
      <Notice>{t('contact.noHealth')}</Notice>
    </Block>
  );
}

export function GrievanceContact({ config, locale }: Props) {
  const { t } = translatorFor(locale);
  const officer = config.grievance;
  return (
    <Block id="contact-grievance" title={t('contact.grievanceTitle')}>
      {officer ? (
        <>
          <dl className="contact-details">
            <Detail label={t('contact.name')}>{officer.name}</Detail>
            <Detail label={t('contact.designation')}>{t('contact.designationValue')}</Detail>
            <Detail label={t('contact.email')}>
              <a href={`mailto:${officer.email}`}>{officer.email}</a>
            </Detail>
            <Detail label={t('contact.phone')}>
              <a href={`tel:${officer.phone}`}>{officer.phone}</a>{' '}
              <CopyNumber value={officer.phone} locale={locale} />
            </Detail>
          </dl>
          <p>
            {t('contact.deadlines', { hours: officer.acknowledgeHours, days: officer.resolveDays })}
          </p>
        </>
      ) : (
        <Notice tone="warning">{t('contact.grievancePending')}</Notice>
      )}
      <h3>{t('contact.stepsTitle')}</h3>
      <ol className="site-steps">
        {(['0', '1', '2'] as const).map((step) => (
          <li key={step}>{t(`contact.steps.${step}`)}</li>
        ))}
      </ol>
      <a className="site-link" href={`/${locale}/pages/grievance`}>
        {t('contact.grievanceMore')}
      </a>
    </Block>
  );
}

/** DPDP Rules 2025, rule 9: who answers questions about personal data. */
export function DataContact({ config, locale }: Props) {
  const { t } = translatorFor(locale);
  return (
    <Block id="contact-data" title={t('contact.dataTitle')}>
      <p>{t('contact.dataBody')}</p>
      {config.dataContactEmail ? (
        <dl className="contact-details">
          <Detail label={t('contact.dataContact')}>
            <a href={`mailto:${config.dataContactEmail}`}>{config.dataContactEmail}</a>
          </Detail>
        </dl>
      ) : (
        <Notice tone="warning">{t('contact.dataPending')}</Notice>
      )}
    </Block>
  );
}

/** A plain maps link, not an embedded map: no third-party script, nothing sent until tapped. */
function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function CompanyDetails({ config, locale }: Props) {
  const { t } = translatorFor(locale);
  const { legalName, legalAddress, cin } = config;
  return (
    <Block id="contact-company" title={t('contact.companyTitle')}>
      {legalName && legalAddress ? (
        <>
          <dl className="contact-details">
            <Detail label={t('contact.legalName')}>{legalName}</Detail>
            {cin && <Detail label={t('contact.cin')}>{cin}</Detail>}
            <Detail label={t('contact.address')}>{legalAddress}</Detail>
          </dl>
          <a
            className="site-link"
            href={mapsLink(legalAddress)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('contact.maps')}
          </a>
        </>
      ) : (
        <Notice tone="warning">{t('site.legalPending')}</Notice>
      )}
    </Block>
  );
}
