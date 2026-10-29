'use client';

import { formatDateTime } from '@heach/i18n';
import { Button, Card, Notice } from '@heach/ui';
import type { LabOrder, StoredFile, VisitCode } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { keyFor } from '../../lib/message-keys';
import { usePending } from '../../lib/use-pending';
import { useResource } from '../../lib/use-resource';

/** A lab order as the patient sees it (LB-05 to LB-08): stage, collector, sample, code, report. */
export function PatientLabPanel({ bookingId }: Readonly<{ bookingId: string }>) {
  const { locale, t } = useI18n();
  const { resource } = useResource<LabOrder>(`/bookings/${bookingId}/lab?locale=${locale}`);
  const [code, setCode] = useState<string | undefined>();
  const [report, setReport] = useState<string | undefined>();
  const { pending, error, run } = usePending();
  if (resource.state !== 'ready') return null;
  const order = resource.data;
  const codeReady =
    order.collection === 'home' ? order.stage === 'collector_assigned' : order.stage === 'booked';
  return (
    <Card title={t('lab.title')}>
      <p>
        <strong>{t(keyFor('lab.stage', order.stage, 'lab.title'))}</strong> ·{' '}
        {t(order.collection === 'home' ? 'lab.home' : 'lab.walkIn')}
      </p>
      <ul>
        {order.items.map((item) => (
          <li key={item.itemCode}>{item.name}</li>
        ))}
      </ul>
      {order.collector && (
        <p>
          {t('lab.collector', { name: order.collector.name })}
          {order.collector.verified && ` · ${t('lab.verified')}`}
        </p>
      )}
      {order.sampleId && <p>{t('lab.sampleId', { id: order.sampleId })}</p>}
      {order.reportDueAt && order.stage !== 'report_ready' && (
        <p className="flow__muted">
          {t('lab.due', { time: formatDateTime(new Date(order.reportDueAt), locale) })}
        </p>
      )}
      {codeReady &&
        ['confirmed', 'in_progress'].includes(order.status) &&
        (code ? (
          <p className="visit-code">{t('visit.code', { code })}</p>
        ) : (
          <Button
            onClick={() =>
              void run(async () => {
                setCode((await api<VisitCode>(`/bookings/${bookingId}/lab/code`)).code);
              })
            }
            disabled={pending}
          >
            {t('lab.showCode')}
          </Button>
        ))}
      {order.reports.length > 0 &&
        (report ? (
          <a href={report} download={`report-${bookingId}.pdf`}>
            {t('lab.report')}
          </a>
        ) : (
          <Button
            onClick={() =>
              void run(async () => {
                const file = await api<StoredFile>(`/bookings/${bookingId}/lab/report`);
                setReport(`data:${file.contentType};base64,${file.contentBase64}`);
              })
            }
            disabled={pending}
          >
            {t('lab.report')}
          </Button>
        ))}
      {order.reports.map((version) => (
        <p key={version.version} className="flow__muted">
          {t('lab.version', { version: version.version })}
          {version.correctionReason &&
            ` · ${t('lab.corrected', { reason: t(keyFor('lab.reasons', version.correctionReason, 'lab.reasons.other')) })}`}
        </p>
      ))}
      {error && (
        <Notice tone="info" live>
          {t(error)}
        </Notice>
      )}
    </Card>
  );
}
