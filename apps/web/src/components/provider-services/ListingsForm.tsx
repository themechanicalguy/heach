'use client';

import { Button, Card, CheckboxField, Notice, TextField } from '@heach/ui';
import type { ListableItem, ProviderListings } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';

interface Props {
  role: string;
  item: ListableItem;
  onSaved: (listings: ProviderListings) => void;
}

/** One catalogue item: fee, duration, and offered or paused (SL-02 to SL-04, SL-07, SL-09). */
export function ListingRow({ role, item, onSaved }: Readonly<Props>) {
  const { t } = useI18n();
  const listing = item.listing;
  const [fee, setFee] = useState(listing ? String(listing.feePaise / 100) : '');
  const [minutes, setMinutes] = useState(
    String(listing?.durationMinutes ?? item.defaultDurationMinutes),
  );
  const [active, setActive] = useState(listing?.active ?? true);
  const [hospital, setHospital] = useState(listing?.careSettings.includes('hospital') ?? false);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const save = () =>
    run(async () => {
      const body = {
        feePaise: Math.round(Number(fee) * 100),
        durationMinutes: Number(minutes),
        active,
        careSettings: role === 'attendant' ? ['home', ...(hospital ? ['hospital'] : [])] : [],
        homeCollection: true,
      };
      onSaved(
        await api<ProviderListings>(`/provider/listings/${item.code}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
      setSaved(true);
    });
  return (
    <Card title={item.name}>
      <div className="flow__form">
        <TextField
          label={t('providerServices.fee')}
          inputMode="decimal"
          value={fee}
          onChange={(event) => {
            setFee(event.currentTarget.value);
            setSaved(false);
          }}
        />
        <TextField
          label={t('providerServices.duration')}
          inputMode="numeric"
          value={minutes}
          onChange={(event) => {
            setMinutes(event.currentTarget.value);
            setSaved(false);
          }}
        />
        <CheckboxField
          label={t('providerServices.offered')}
          checked={active}
          onChange={(event) => {
            setActive(event.currentTarget.checked);
            setSaved(false);
          }}
        />
        {role === 'attendant' && (
          <CheckboxField
            label={t('providerServices.hospital')}
            checked={hospital}
            onChange={(event) => {
              setHospital(event.currentTarget.checked);
              setSaved(false);
            }}
          />
        )}
        {error && (
          <Notice tone="danger" live>
            {t(error)}
          </Notice>
        )}
        {saved && (
          <Notice tone="success" live>
            {t('providerServices.saved')}
          </Notice>
        )}
        <Button onClick={() => void save()} disabled={pending || !fee}>
          {t('providerServices.save')}
        </Button>
      </div>
    </Card>
  );
}

/** The PIN codes the provider visits and their travel charge (SL-05). */
export function AreaForm({
  listings,
  onSaved,
}: Readonly<{ listings: ProviderListings; onSaved: (listings: ProviderListings) => void }>) {
  const { t } = useI18n();
  const [pins, setPins] = useState<string[]>(listings.pins);
  const [surcharge, setSurcharge] = useState(String(listings.travelSurchargePaise / 100));
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = usePending();
  const save = () =>
    run(async () => {
      const body = { pins, travelSurchargePaise: Math.round(Number(surcharge) * 100) };
      onSaved(
        await api<ProviderListings>('/provider/service-area', {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
      setSaved(true);
    });
  return (
    <Card title={t('providerServices.area')}>
      <p className="flow__muted">{t('providerServices.areaIntro')}</p>
      <fieldset className="pin-grid">
        <legend>{t('providerServices.area')}</legend>
        {listings.serviceablePins.map((pin) => (
          <CheckboxField
            key={pin.pin}
            label={`${pin.pin} · ${pin.district}`}
            checked={pins.includes(pin.pin)}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setPins((current) =>
                checked ? [...current, pin.pin] : current.filter((value) => value !== pin.pin),
              );
              setSaved(false);
            }}
          />
        ))}
      </fieldset>
      <TextField
        label={t('providerServices.surcharge')}
        inputMode="decimal"
        value={surcharge}
        onChange={(event) => {
          setSurcharge(event.currentTarget.value);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {saved && (
        <Notice tone="success" live>
          {t('providerServices.saved')}
        </Notice>
      )}
      <Button onClick={() => void save()} disabled={pending}>
        {t('providerServices.saveArea')}
      </Button>
    </Card>
  );
}
