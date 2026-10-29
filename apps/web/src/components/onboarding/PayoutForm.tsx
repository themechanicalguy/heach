'use client';

import { Button, Card, ChoiceGroup, Notice, TextField } from '@heach/ui';
import type { Application } from '@heach/types';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { useReverified } from '../account/use-reverified';

interface Props {
  application: Application;
  onSaved: (application: Application) => void;
}

/** Payout details (PO-06): saving them needs a fresh OTP, asked for in a sheet (AC-05). */
export function PayoutForm({ application, onSaved }: Readonly<Props>) {
  const { t } = useI18n();
  const [method, setMethod] = useState<'bank' | 'upi'>('upi');
  const [fields, setFields] = useState({ holderName: '', accountNumber: '', ifsc: '', upiId: '' });
  const { pending, error, run } = usePending();
  const { attempt, sheet } = useReverified(run);
  const payout = application.payout;
  const field = (name: keyof typeof fields, label: string) => (
    <TextField
      label={label}
      value={fields[name]}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setFields((current) => ({ ...current, [name]: value }));
      }}
    />
  );
  const save = () =>
    attempt(async () => {
      const body =
        method === 'bank'
          ? {
              method,
              holderName: fields.holderName,
              accountNumber: fields.accountNumber,
              ifsc: fields.ifsc.toUpperCase(),
            }
          : { method, holderName: fields.holderName, upiId: fields.upiId };
      onSaved(
        await api<Application>('/provider/application/payout', {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
    });

  return (
    <Card title={t('application.payoutTitle')}>
      <p className="flow__muted">{t('application.payoutIntro')}</p>
      {payout && (
        <Notice tone="success">
          {t('application.payoutOnFile', {
            method: t(`application.payoutMethod.${payout.method}`),
            hint: payout.hint,
            name: payout.holderName,
          })}
        </Notice>
      )}
      {application.editable && (
        <div className="flow__form">
          <ChoiceGroup
            legend={t('application.payoutTitle')}
            name="payout-method"
            value={method}
            choices={[
              { value: 'upi', label: t('application.payoutMethod.upi') },
              { value: 'bank', label: t('application.payoutMethod.bank') },
            ]}
            onChange={(value) => {
              setMethod(value === 'bank' ? 'bank' : 'upi');
            }}
          />
          {field('holderName', t('application.holderName'))}
          {method === 'bank' ? (
            <>
              {field('accountNumber', t('application.accountNumber'))}
              {field('ifsc', t('application.ifsc'))}
            </>
          ) : (
            field('upiId', t('application.upiId'))
          )}
          {error && (
            <Notice tone="danger" live>
              {t(error)}
            </Notice>
          )}
          <Button onClick={() => void save()} disabled={pending}>
            {t('application.savePayout')}
          </Button>
        </div>
      )}
      {sheet}
    </Card>
  );
}
