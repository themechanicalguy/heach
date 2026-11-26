import { normalizeDigits } from '@heach/i18n';
import { Button, ChoiceGroup, Notice, OtpField, TextField } from '@heach/ui';
import type { AssistedPayoutChallenge, AssistedSession } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { assistedPath, useAssistedCall, type StepProps } from '../use-assisted-call';
import { useCountdown } from '../use-countdown';
import { ErrorNotice } from './AssistedParts';

const NO_FIELDS = { holderName: '', accountNumber: '', ifsc: '', upiId: '' };

type FieldName = keyof typeof NO_FIELDS;

interface InputsProps {
  method: 'bank' | 'upi';
  onMethod: (method: 'bank' | 'upi') => void;
  fields: typeof NO_FIELDS;
  onField: (name: FieldName, value: string) => void;
}

/** The payout method and its fields (PO-06). */
function PayoutInputs({ method, onMethod, fields, onField }: Readonly<InputsProps>) {
  const field = (name: FieldName, text: string) => (
    <TextField
      label={text}
      value={fields[name]}
      autoComplete="off"
      onChange={(event) => {
        onField(name, event.currentTarget.value);
      }}
    />
  );
  return (
    <>
      <ChoiceGroup
        legend={t('assisted.payout.method')}
        name="assisted-payout-method"
        value={method}
        choices={[
          { value: 'upi', label: t('assisted.payout.methods.upi') },
          { value: 'bank', label: t('assisted.payout.methods.bank') },
        ]}
        onChange={(value) => {
          onMethod(value === 'bank' ? 'bank' : 'upi');
        }}
      />
      {field('holderName', t('assisted.payout.holderName'))}
      {method === 'bank' ? (
        <>
          {field('accountNumber', t('assisted.payout.accountNumber'))}
          {field('ifsc', t('assisted.payout.ifsc'))}
        </>
      ) : (
        field('upiId', t('assisted.payout.upiId'))
      )}
    </>
  );
}

interface FormProps extends StepProps {
  challenge: AssistedPayoutChallenge | undefined;
  onChallenge: (challenge: AssistedPayoutChallenge | undefined) => void;
}

/** The payout fields and the provider's code; the typed values are dropped once saved. */
function PayoutFields({ session, onSession, challenge, onChallenge }: Readonly<FormProps>) {
  const [method, setMethod] = useState<'bank' | 'upi'>('upi');
  const [fields, setFields] = useState(NO_FIELDS);
  const [code, setCode] = useState('');
  const countdown = useCountdown(challenge?.resendInSeconds ?? 0);
  const { pending, error, other, sensitive, sheet } = useAssistedCall(onSession);
  const setField = (name: FieldName, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
  };
  const save = () =>
    sensitive(async () => {
      const common = { code, holderName: fields.holderName };
      const body =
        method === 'bank'
          ? {
              ...common,
              method,
              accountNumber: fields.accountNumber,
              ifsc: fields.ifsc.toUpperCase(),
            }
          : { ...common, method, upiId: fields.upiId };
      const next = await api<AssistedSession>(assistedPath(session, '/payout'), {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setFields(NO_FIELDS);
      setCode('');
      onChallenge(undefined);
      return next;
    });
  const resend = () =>
    other(async () => {
      const next = await api<AssistedPayoutChallenge>(
        assistedPath(session, '/payout/code/resend'),
        { method: 'POST' },
      );
      countdown.restart(next.resendInSeconds);
      onChallenge(next);
    });
  return (
    <div className="admin-form">
      {challenge && (
        <Notice tone="info" live>
          {t('assisted.payout.codeSent', { mobile: challenge.mobile })}
        </Notice>
      )}
      <OtpField
        label={t('assisted.payout.code')}
        value={code}
        onChange={(event) => {
          setCode(normalizeDigits(event.target.value).replace(/\D/g, ''));
        }}
      />
      <PayoutInputs method={method} onMethod={setMethod} fields={fields} onField={setField} />
      <ErrorNotice error={error} />
      <div className="admin-actions">
        <Button onClick={() => void save()} disabled={pending || code.length !== 6}>
          {t('assisted.payout.save')}
        </Button>
        <Button
          className="heach-button--secondary"
          onClick={() => void resend()}
          disabled={pending || countdown.seconds > 0}
        >
          {t('assisted.payout.resendCode')}
        </Button>
        {countdown.seconds > 0 && (
          <span>{t('assisted.resendIn', { seconds: countdown.seconds })}</span>
        )}
      </div>
      {sheet}
    </div>
  );
}

/** Step 6 (PO-06): payout details, saved only with the provider's own second code. */
export function AssistedPayout(props: Readonly<StepProps>) {
  const { session, application, onSession } = props;
  const [challenge, setChallenge] = useState<AssistedPayoutChallenge | undefined>();
  const { pending, error, other } = useAssistedCall(onSession);
  const sendCode = () =>
    other(async () => {
      setChallenge(
        await api<AssistedPayoutChallenge>(assistedPath(session, '/payout/code'), {
          method: 'POST',
        }),
      );
    });
  if (!application.needsPayout)
    return <Notice tone="info">{t('assisted.payout.notNeeded')}</Notice>;
  return (
    <section aria-label={t('assisted.steps.payout')}>
      <h2>{t('assisted.steps.payout')}</h2>
      <p>{t('assisted.payout.intro')}</p>
      {application.payoutOnFile && <Notice tone="success">{t('assisted.payout.onFile')}</Notice>}
      {!challenge && !session.payoutCodeSent && (
        <>
          <ErrorNotice error={error} />
          <Button onClick={() => void sendCode()} disabled={pending}>
            {t('assisted.payout.sendCode')}
          </Button>
        </>
      )}
      {(challenge ?? session.payoutCodeSent) && (
        <PayoutFields {...props} challenge={challenge} onChallenge={setChallenge} />
      )}
    </section>
  );
}
