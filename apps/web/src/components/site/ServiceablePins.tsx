import { formatDateTime } from '@heach/i18n';
import type { PinCoverage } from '@heach/types';
import { Table, type TableColumn } from '@heach/ui';
import { translatorFor, type T } from '../../i18n/messages';
import type { Service } from '../care/services';
import { UsePinButton } from './UsePinButton';

interface Props {
  pins: readonly PinCoverage[];
  service: Service;
  locale: string;
  /** The search form is on the page, so a row can fill its PIN. */
  accounts: boolean;
}

const BAND_ORDER = { available: 0, limited: 1, none: 2 } as const;

function columns(
  t: T,
  locale: ReturnType<typeof translatorFor>['locale'],
  service: Service,
  accounts: boolean,
): TableColumn<PinCoverage>[] {
  return [
    {
      key: 'pin',
      header: t('pins.pin'),
      cell: (row) => (
        <>
          <strong>{row.pin}</strong>
          {accounts && (
            <UsePinButton
              pin={row.pin}
              service={service}
              label={t('pins.use')}
              ariaLabel={t('pins.useLabel', { pin: row.pin })}
            />
          )}
        </>
      ),
    },
    { key: 'district', header: t('pins.district'), cell: (row) => row.district },
    {
      key: 'availability',
      header: t('pins.availability'),
      cell: (row) => (
        <span className={`pin-band pin-band--${row.band}`}>
          {t(`pins.${row.band}`)}
          <span className="flow__muted"> {t('pins.providers', { count: row.providers })}</span>
        </span>
      ),
    },
    {
      key: 'next',
      header: t('pins.next'),
      cell: (row) =>
        row.nextAvailable ? formatDateTime(new Date(row.nextAvailable), locale) : t('pins.noSlot'),
    },
  ];
}

/**
 * Which PIN codes can book this service, and roughly how soon (SD-04). Counts and times are a
 * guide from a short-lived cache; booking checks the real slots. PINs nobody serves yet are
 * folded away so the ones that matter stay in view.
 */
export function ServiceablePins({ pins, service, locale, accounts }: Readonly<Props>) {
  const { t, locale: resolved } = translatorFor(locale);
  const served = pins
    .filter((pin) => pin.band !== 'none')
    .sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band] || a.pin.localeCompare(b.pin));
  const unserved = pins.filter((pin) => pin.band === 'none');
  return (
    <section className="site-section" aria-labelledby="serviceable-pins">
      <h2 id="serviceable-pins">{t('pins.title')}</h2>
      <p>{t('pins.intro')}</p>
      {served.length > 0 ? (
        <Table
          caption={t('pins.caption', { service: t(`services.${service}`) })}
          columns={columns(t, resolved, service, accounts)}
          rows={served}
          rowKey={(row) => row.pin}
        />
      ) : (
        <p>{t('pins.nobody')}</p>
      )}
      {unserved.length > 0 && (
        <details>
          <summary>{t('pins.unserved', { count: unserved.length })}</summary>
          <ul className="pin-list">
            {unserved.map((pin) => (
              <li key={pin.pin}>
                {pin.pin} <span className="flow__muted">{pin.district}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
