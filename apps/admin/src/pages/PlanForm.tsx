import { Button, Notice, TextField } from '@heach/ui';
import type { PlanInput } from '@heach/types';
import { useState } from 'react';
import { api } from '../api';
import { errorText, t } from '../i18n';
import { usePending } from '../use-pending';
import { Choice } from './Tickets';

const LANGUAGES = ['or', 'en', 'hi'] as const;
const SERVICES = ['physiotherapy', 'nursing', 'attendant', 'lab'];
type Text = PlanInput['texts']['en'];
type Numbers = Record<'units' | 'discount' | 'family' | 'validity' | 'rupees', string>;

const EMPTY_TEXT: Text = { name: '', inclusions: '', exclusions: '' };

/** A platform plan (PK-01, PK-02): created live; the patient-facing text in all three languages. */
export function PlanForm({ onCreated }: Readonly<{ onCreated: () => void }>) {
  const [kind, setKind] = useState('package');
  const [itemCode, setItemCode] = useState('');
  const [service, setService] = useState('physiotherapy');
  const [period, setPeriod] = useState('monthly');
  const [numbers, setNumbers] = useState<Numbers>({
    units: '10',
    discount: '0',
    family: '0',
    validity: '90',
    rupees: '',
  });
  const [texts, setTexts] = useState({ or: EMPTY_TEXT, en: EMPTY_TEXT, hi: EMPTY_TEXT });
  const [created, setCreated] = useState(false);
  const { pending, error, run } = usePending();
  const body = (): PlanInput => ({
    kind: kind as PlanInput['kind'],
    ...(kind === 'package'
      ? { itemCode: itemCode.trim() }
      : {
          service: service as NonNullable<PlanInput['service']>,
          period: period as NonNullable<PlanInput['period']>,
        }),
    units: Number(numbers.units),
    discountPercent: Number(numbers.discount),
    familyMembers: Number(numbers.family),
    validityDays: Number(numbers.validity),
    pricePaise: Math.round(Number(numbers.rupees) * 100),
    texts,
  });
  const submit = () =>
    run(async () => {
      setCreated(false);
      await api('/plans', { method: 'POST', body: JSON.stringify(body()) });
      setCreated(true);
      onCreated();
    });
  const number = (key: keyof Numbers) => (
    <TextField
      label={t(`plans.${key}`)}
      type="number"
      required
      value={numbers[key]}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setNumbers((current) => ({ ...current, [key]: value }));
      }}
    />
  );
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2>{t('plans.create')}</h2>
      <Coverage
        kind={kind}
        itemCode={itemCode}
        service={service}
        period={period}
        onKind={setKind}
        onItemCode={setItemCode}
        onService={setService}
        onPeriod={setPeriod}
      />
      {number('units')}
      {number('discount')}
      {number('family')}
      {number('validity')}
      {number('rupees')}
      {LANGUAGES.map((language) => (
        <PlanTexts
          key={language}
          language={language}
          text={texts[language]}
          onChange={(text) => {
            setTexts((current) => ({ ...current, [language]: text }));
          }}
        />
      ))}
      {error !== undefined && <Notice tone="danger">{errorText(error)}</Notice>}
      {created && <Notice tone="success">{t('plans.created')}</Notice>}
      <Button type="submit" disabled={pending}>
        {t('plans.save')}
      </Button>
    </form>
  );
}

interface CoverageProps {
  kind: string;
  itemCode: string;
  service: string;
  period: string;
  onKind: (kind: string) => void;
  onItemCode: (itemCode: string) => void;
  onService: (service: string) => void;
  onPeriod: (period: string) => void;
}

/** What the plan covers: a catalogue item for packages, a service and period for subscriptions. */
function Coverage(props: Readonly<CoverageProps>) {
  const { kind, itemCode, service, period } = props;
  return (
    <>
      <Choice
        label={t('plans.kind')}
        value={kind}
        onChange={props.onKind}
        group="plans.kinds"
        values={['package', 'subscription']}
      />
      {kind === 'package' ? (
        <TextField
          label={t('plans.itemCode')}
          required
          value={itemCode}
          onChange={(event) => {
            props.onItemCode(event.currentTarget.value);
          }}
        />
      ) : (
        <>
          <Choice
            label={t('plans.service')}
            value={service}
            onChange={props.onService}
            group="plans.services"
            values={SERVICES}
          />
          <Choice
            label={t('plans.period')}
            value={period}
            onChange={props.onPeriod}
            group="plans.periods"
            values={['monthly', 'quarterly', 'yearly']}
          />
        </>
      )}
    </>
  );
}

interface TextsProps {
  language: (typeof LANGUAGES)[number];
  text: Text;
  onChange: (text: Text) => void;
}

function PlanTexts({ language, text, onChange }: Readonly<TextsProps>) {
  const languageName = t(`plans.languages.${language}`);
  const set = (key: keyof Text) => (event: { currentTarget: { value: string } }) => {
    onChange({ ...text, [key]: event.currentTarget.value });
  };
  return (
    <fieldset>
      <legend>{t('plans.textsFor', { language: languageName })}</legend>
      <TextField
        label={`${t('plans.planName')} (${languageName})`}
        required
        value={text.name}
        onChange={set('name')}
      />
      <TextField
        label={`${t('plans.inclusions')} (${languageName})`}
        required
        multiline
        value={text.inclusions}
        onChange={set('inclusions')}
      />
      <TextField
        label={`${t('plans.exclusions')} (${languageName})`}
        required
        multiline
        value={text.exclusions}
        onChange={set('exclusions')}
      />
    </fieldset>
  );
}
