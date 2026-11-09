import { normalizeDigits } from '@heach/i18n';
import { TextField } from '@heach/ui';
import { useI18n } from '../../lib/i18n-context';
import { Select } from '../care/SearchView';

export const INTAKE_AREAS = [
  'back',
  'neck',
  'shoulder',
  'knee',
  'hip',
  'ankle_foot',
  'other',
] as const;

export interface IntakeState {
  reason: string;
  area: string;
  age: string;
  contactName: string;
  contactPhone: string;
}

export const EMPTY_INTAKE: IntakeState = {
  reason: '',
  area: '',
  age: '',
  contactName: '',
  contactPhone: '',
};

/** The visit details sent with a physiotherapy booking; empty fields are left out (BK-01). */
export function intakeBody(state: IntakeState) {
  return {
    reason: state.reason.trim() || undefined,
    area: state.area || undefined,
    ageYears: state.age ? Number(state.age) : undefined,
    contactName: state.contactName.trim() || undefined,
    contactPhone: state.contactPhone || undefined,
  };
}

interface Props {
  value: IntakeState;
  onChange: (key: keyof IntakeState, next: string) => void;
}

/** What a physiotherapist needs before the visit; reason, area and age are required. */
export function PhysioIntakeFields({ value, onChange }: Readonly<Props>) {
  const { t } = useI18n();
  return (
    <fieldset className="booking-intake">
      <legend className="booking-intake__title">{t('book.intake.title')}</legend>
      <TextField
        label={t('book.intake.reason')}
        hint={t('book.intake.reasonHint')}
        multiline
        required
        maxLength={200}
        value={value.reason}
        onChange={(event) => {
          onChange('reason', event.currentTarget.value);
        }}
      />
      <Select
        label={t('book.intake.area')}
        required
        value={value.area}
        onChange={(next) => {
          onChange('area', next);
        }}
        options={[
          ['', t('book.intake.areaChoose')],
          ...INTAKE_AREAS.map((area): [string, string] => [area, t(`book.intake.areas.${area}`)]),
        ]}
      />
      <TextField
        label={t('book.intake.age')}
        hint={t('book.intake.ageHint')}
        type="number"
        inputMode="numeric"
        required
        min={0}
        max={120}
        value={value.age}
        onChange={(event) => {
          onChange('age', normalizeDigits(event.currentTarget.value.trim()));
        }}
      />
      <div className="booking-intake__contact">
        <TextField
          label={t('book.intake.contactName')}
          maxLength={80}
          autoComplete="off"
          value={value.contactName}
          onChange={(event) => {
            onChange('contactName', event.currentTarget.value);
          }}
        />
        <TextField
          label={t('book.intake.contactPhone')}
          hint={t('book.intake.contactHint')}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          value={value.contactPhone}
          onChange={(event) => {
            onChange('contactPhone', normalizeDigits(event.currentTarget.value.trim()));
          }}
        />
      </div>
    </fieldset>
  );
}
