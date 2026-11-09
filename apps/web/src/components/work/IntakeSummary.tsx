import type { ProviderRequest } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';

type Intake = NonNullable<ProviderRequest['intake']>;

/** The patient's visit details, as the provider reads them before accepting (BK-01). */
export function IntakeSummary({ intake }: Readonly<{ intake: Intake }>) {
  const { t } = useI18n();
  return (
    <>
      {intake.reason && <p>{t('requests.intake.reason', { reason: intake.reason })}</p>}
      {intake.area && (
        <p>{t('requests.intake.area', { area: t(`book.intake.areas.${intake.area}`) })}</p>
      )}
      {intake.ageYears !== undefined && (
        <p>{t('requests.intake.age', { age: String(intake.ageYears) })}</p>
      )}
    </>
  );
}
