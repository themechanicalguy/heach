'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, EmptyState, Notice, TextField } from '@heach/ui';
import type { Collector, LabDashboard, LabOrder } from '@heach/types';
import { useState } from 'react';
import { api, UPLOAD_CONTENT_TYPE } from '../../lib/api';
import { readAsBase64 } from '../../lib/files';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';
import { ResourceView } from '../account/ResourceView';
import { Select } from '../care/SearchView';

type Refresh = () => Promise<void>;
const CORRECTIONS = ['wrong_value', 'wrong_patient_detail', 'missing_test', 'other'] as const;
const RECOLLECT = ['sample_haemolysed', 'insufficient_sample', 'sample_lost', 'other'] as const;

/** The lab's orders and dashboard (LB-05 to LB-11). */
export function LabOrdersView() {
  const { locale, t } = useI18n();
  const orders = useResource<LabOrder[]>(`/provider/lab/orders?locale=${locale}`);
  const dashboard = useResource<LabDashboard>('/provider/lab/dashboard');
  const collectors = useResource<Collector[]>('/provider/lab/collectors');
  const crew = collectors.resource.state === 'ready' ? collectors.resource.data : [];
  const refresh = async () => {
    await orders.reload();
    await dashboard.reload();
  };
  return (
    <section className="flow" aria-labelledby="lab-title">
      <div className="flow__card">
        <h1 id="lab-title" className="flow__title">
          {t('lab.ordersTitle')}
        </h1>
        {dashboard.resource.state === 'ready' && (
          <Notice tone="info">
            {t('lab.dashboard', {
              today: dashboard.resource.data.todayCollections,
              pending: dashboard.resource.data.pendingReports,
              hours: dashboard.resource.data.averageTurnaroundHours ?? '—',
              late: dashboard.resource.data.lateReports,
            })}
          </Notice>
        )}
        <ResourceView resource={orders.resource} reload={orders.reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('lab.ordersEmpty')} />
            ) : (
              <ul className="role-list">
                {rows.map((order) => (
                  <li key={order.bookingId}>
                    <OrderCard order={order} collectors={crew} onChanged={refresh} />
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
      </div>
    </section>
  );
}

function OrderCard({
  order,
  collectors,
  onChanged,
}: Readonly<{ order: LabOrder; collectors: readonly Collector[]; onChanged: Refresh }>) {
  const { locale, t } = useI18n();
  const { pending, error, run } = usePending();
  const post = (path: string, body?: object) =>
    run(async () => {
      await api(`/provider/lab/orders/${order.bookingId}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await onChanged();
    });
  const walkInReady = order.collection === 'walk_in' && order.stage === 'booked';
  return (
    <Card title={order.items.map((item) => item.name).join(', ')}>
      <p>
        <strong>{t(keyFor('lab.stage', order.stage, 'lab.title'))}</strong> ·{' '}
        {formatDateTime(new Date(order.startsAt), locale)} ·{' '}
        {t(order.collection === 'home' ? 'lab.home' : 'lab.walkIn')}
      </p>
      {order.sampleId && <p>{t('lab.sampleId', { id: order.sampleId })}</p>}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {order.collection === 'home' && ['booked', 'collector_assigned'].includes(order.stage) && (
        <AssignCollector
          collectors={collectors}
          pending={pending}
          onAssign={(collectorId) => post('collector', { collectorId })}
        />
      )}
      {walkInReady && (
        <CollectWithCode
          path={`/provider/lab/orders/${order.bookingId}/collect`}
          onDone={onChanged}
        />
      )}
      {order.stage === 'sample_collected' && (
        <Button onClick={() => void post('received')} disabled={pending}>
          {t('lab.received')}
        </Button>
      )}
      {['received', 'report_ready'].includes(order.stage) && (
        <ReportUpload order={order} onDone={onChanged} />
      )}
      {['sample_collected', 'received'].includes(order.stage) && (
        <Recollect pending={pending} onRecollect={(reason) => post('recollect', { reason })} />
      )}
    </Card>
  );
}

function AssignCollector({
  collectors,
  pending,
  onAssign,
}: Readonly<{
  collectors: readonly Collector[];
  pending: boolean;
  onAssign: (id: string) => Promise<void>;
}>) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState(collectors[0]?.id ?? '');
  return (
    <>
      <Select
        label={t('lab.chooseCollector')}
        value={chosen}
        onChange={setChosen}
        options={collectors.map((collector) => [collector.id, collector.name] as const)}
      />
      <Button onClick={() => void onAssign(chosen)} disabled={pending || !chosen}>
        {t('lab.assign')}
      </Button>
    </>
  );
}

export function CollectWithCode({ path, onDone }: Readonly<{ path: string; onDone: Refresh }>) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [sample, setSample] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  if (sample)
    return (
      <Notice tone="success" live>
        {t('lab.collected', { id: sample })}
      </Notice>
    );
  return (
    <div className="flow__form">
      <TextField
        label={t('lab.enterCode')}
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(event) => {
          setCode(event.currentTarget.value.trim());
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button
        disabled={pending || code.length !== 6}
        onClick={() =>
          void run(async () => {
            const result = await api<{ sampleId: string }>(path, {
              method: 'POST',
              body: JSON.stringify({ code }),
            });
            setSample(result.sampleId);
            await onDone();
          })
        }
      >
        {t('lab.collect')}
      </Button>
    </div>
  );
}

function ReportUpload({ order, onDone }: Readonly<{ order: LabOrder; onDone: Refresh }>) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | undefined>();
  const [sampleId, setSampleId] = useState('');
  const [correction, setCorrection] = useState<string>('wrong_value');
  const { pending, error, run } = usePending();
  const correcting = order.stage === 'report_ready';
  const upload = () =>
    run(async () => {
      if (!file) return;
      const body = {
        contentType: file.type,
        contentBase64: await readAsBase64(file),
        sampleId,
        ...(correcting ? { correctionReason: correction } : {}),
      };
      await api(`/provider/lab/orders/${order.bookingId}/report`, {
        method: 'POST',
        headers: { 'content-type': UPLOAD_CONTENT_TYPE },
        body: JSON.stringify(body),
      });
      setFile(undefined);
      await onDone();
    });
  return (
    <div className="flow__form">
      <TextField
        label={t('lab.uploadReport')}
        type="file"
        accept="application/pdf"
        onChange={(event) => {
          setFile(event.currentTarget.files?.[0]);
        }}
      />
      <TextField
        label={t('lab.sampleCheck')}
        value={sampleId}
        onChange={(event) => {
          setSampleId(event.currentTarget.value.trim().toUpperCase());
        }}
      />
      {correcting && (
        <Select
          label={t('lab.correction')}
          value={correction}
          onChange={setCorrection}
          options={CORRECTIONS.map((value) => [value, t(`lab.reasons.${value}`)] as const)}
        />
      )}
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      <Button onClick={() => void upload()} disabled={pending || !file || !sampleId}>
        {t('lab.upload')}
      </Button>
    </div>
  );
}

function Recollect({
  pending,
  onRecollect,
}: Readonly<{ pending: boolean; onRecollect: (reason: string) => Promise<void> }>) {
  const { t } = useI18n();
  const [why, setWhy] = useState<string>('insufficient_sample');
  return (
    <>
      <Select
        label={t('lab.recollectReason')}
        value={why}
        onChange={setWhy}
        options={RECOLLECT.map((value) => [value, t(`lab.reasons.${value}`)] as const)}
      />
      <Button
        className="heach-button--secondary"
        onClick={() => void onRecollect(why)}
        disabled={pending}
      >
        {t('lab.recollect')}
      </Button>
    </>
  );
}

/** A collector's assigned home collections, with the address (LB-05, LB-06). */
export function CollectionsView() {
  const { locale, t } = useI18n();
  const { resource, reload } = useResource<LabOrder[]>(`/provider/collections?locale=${locale}`);
  return (
    <section className="flow" aria-labelledby="collections-title">
      <div className="flow__card">
        <h1 id="collections-title" className="flow__title">
          {t('lab.collectionsTitle')}
        </h1>
        <ResourceView resource={resource} reload={reload}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState message={t('lab.collectionsEmpty')} />
            ) : (
              <ul className="role-list">
                {rows.map((order) => (
                  <li key={order.bookingId}>
                    <Card title={order.items.map((item) => item.name).join(', ')}>
                      <p>{formatDateTime(new Date(order.startsAt), locale)}</p>
                      {order.address && <p>{order.address}</p>}
                      <CollectWithCode
                        path={`/provider/collections/${order.bookingId}/collect`}
                        onDone={reload}
                      />
                    </Card>
                  </li>
                ))}
              </ul>
            )
          }
        </ResourceView>
      </div>
    </section>
  );
}
