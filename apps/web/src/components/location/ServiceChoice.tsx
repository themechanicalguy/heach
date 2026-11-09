import { Icon } from '@heach/ui';
import { useI18n } from '../../lib/i18n-context';
import { SERVICES, type Service } from '../care/services';

/** The four services as radio tiles: big touch targets, one choice. */
export function ServiceChoice({
  value,
  onChange,
}: Readonly<{ value: Service; onChange: (service: Service) => void }>) {
  const { t } = useI18n();
  return (
    <fieldset className="location-choices">
      <legend className="heach-field__label">{t('location.service')}</legend>
      {SERVICES.map((service) => (
        <label key={service} className="location-choice">
          <input
            type="radio"
            name="location-service"
            value={service}
            checked={value === service}
            onChange={() => {
              onChange(service);
            }}
          />
          <Icon name={service === 'nursing' ? 'nurse' : service} size={22} />
          <span>{t(`services.${service}`)}</span>
        </label>
      ))}
    </fieldset>
  );
}
