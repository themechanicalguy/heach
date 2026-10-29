import { Button, ErrorState, Notice, Skeleton, Table } from '@heach/ui';
import type { CatalogueItem, PinCode } from '@heach/types';
import { type ReactNode, useCallback } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { type Loaded, useLoad } from '../use-load';
import { usePending } from '../use-pending';

type Change = (label: string, onClick: () => Promise<void>, name: string) => ReactNode;

/** The service catalogue and serviceable PIN codes (AD-04, AD-08); only super admin changes them. */
export function Catalogue({ canChange }: Readonly<{ canChange: boolean }>) {
  const items = useLoad(useCallback(() => api<CatalogueItem[]>('/catalogue'), []));
  const pins = useLoad(useCallback(() => api<PinCode[]>('/pins'), []));
  const { pending, error, run } = usePending();
  const put = (path: string, body: object, reload: () => void) =>
    run(async () => {
      await api(path, { method: 'PUT', body: JSON.stringify(body) });
      reload();
    });
  const change: Change = (label, onClick, name) =>
    canChange ? (
      <Button
        className="heach-button--secondary"
        aria-label={`${label} ${name}`}
        disabled={pending}
        onClick={() => void onClick()}
      >
        {label}
      </Button>
    ) : null;

  return (
    <>
      <h1>{t('catalogue.title')}</h1>
      <p>{t('catalogue.intro')}</p>
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      <ItemsTable
        loaded={items.loaded}
        reload={items.reload}
        change={change}
        onToggle={(item) => put(`/catalogue/${item.code}`, { active: !item.active }, items.reload)}
      />
      <h2>{t('catalogue.pins')}</h2>
      <p>{t('catalogue.pinsIntro')}</p>
      <PinsTable
        loaded={pins.loaded}
        change={change}
        onToggle={(pin) => put(`/pins/${pin.pin}`, { serviceable: !pin.serviceable }, pins.reload)}
      />
    </>
  );
}

interface ItemsProps {
  loaded: Loaded<CatalogueItem[]>;
  reload: () => void;
  change: Change;
  onToggle: (item: CatalogueItem) => Promise<void>;
}

function ItemsTable({ loaded, reload, change, onToggle }: Readonly<ItemsProps>) {
  if (loaded.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (loaded.state === 'error') {
    return (
      <ErrorState
        message={errorText(loaded.error)}
        retryLabel={t('state.retry')}
        onRetry={reload}
      />
    );
  }
  const yesNo = (value: boolean) => t(value ? 'catalogue.yes' : 'catalogue.no');
  return (
    <Table
      caption={t('catalogue.caption')}
      rows={loaded.value}
      rowKey={(item) => item.code}
      columns={[
        { key: 'name', header: t('catalogue.name'), cell: (item: CatalogueItem) => item.name },
        {
          key: 'service',
          header: t('catalogue.service'),
          cell: (item: CatalogueItem) => item.service,
        },
        {
          key: 'rx',
          header: t('catalogue.prescription'),
          cell: (item: CatalogueItem) => yesNo(item.prescriptionRequired),
        },
        {
          key: 'active',
          header: t('catalogue.active'),
          cell: (item: CatalogueItem) => t(item.active ? 'catalogue.active' : 'catalogue.paused'),
        },
        {
          key: 'change',
          header: '',
          cell: (item: CatalogueItem) =>
            change(
              t(item.active ? 'catalogue.pause' : 'catalogue.resume'),
              () => onToggle(item),
              item.name,
            ),
        },
      ]}
    />
  );
}

interface PinsProps {
  loaded: Loaded<PinCode[]>;
  change: Change;
  onToggle: (pin: PinCode) => Promise<void>;
}

function PinsTable({ loaded, change, onToggle }: Readonly<PinsProps>) {
  if (loaded.state !== 'ready') return null;
  return (
    <Table
      caption={t('catalogue.pinCaption')}
      rows={loaded.value}
      rowKey={(pin) => pin.pin}
      columns={[
        { key: 'pin', header: t('catalogue.pin'), cell: (pin: PinCode) => pin.pin },
        { key: 'district', header: t('catalogue.district'), cell: (pin: PinCode) => pin.district },
        {
          key: 'state',
          header: t('catalogue.serviceable'),
          cell: (pin: PinCode) =>
            t(pin.serviceable ? 'catalogue.serviceable' : 'catalogue.notServiceable'),
        },
        {
          key: 'change',
          header: '',
          cell: (pin: PinCode) =>
            change(
              t(pin.serviceable ? 'catalogue.stop' : 'catalogue.start'),
              () => onToggle(pin),
              pin.pin,
            ),
        },
      ]}
    />
  );
}
