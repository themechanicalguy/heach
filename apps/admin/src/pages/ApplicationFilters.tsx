import { t } from '../i18n';
import en from '../../messages/en.json';
import { label } from './labels';
import type { QueueFilterValues } from './queue-query';

const ROLES = Object.keys(en.checklists.roles);
const AGES = Object.keys(en.verification.ages);

interface SelectProps {
  legend: string;
  allLabel: string;
  value: string;
  options: { value: string; text: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ legend, allLabel, value, options, onChange }: Readonly<SelectProps>) {
  return (
    <label className="admin-select">
      <span>{legend}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </select>
    </label>
  );
}

interface Props {
  filters: QueueFilterValues;
  onChange: (filters: QueueFilterValues) => void;
}

/** Narrow the verification queue by provider type and by how long it has waited (AD-02). */
export function ApplicationFilters({ filters, onChange }: Readonly<Props>) {
  return (
    <div className="admin-filters" role="group" aria-label={t('verification.filtersLegend')}>
      <FilterSelect
        legend={t('verification.filterRole')}
        allLabel={t('verification.filterRoleAll')}
        value={filters.role}
        options={ROLES.map((value) => ({ value, text: label('checklists.roles', value) }))}
        onChange={(role) => {
          onChange({ ...filters, role });
        }}
      />
      <FilterSelect
        legend={t('verification.filterAge')}
        allLabel={t('verification.filterAgeAll')}
        value={filters.age}
        options={AGES.map((value) => ({ value, text: label('verification.ages', value) }))}
        onChange={(age) => {
          onChange({ ...filters, age });
        }}
      />
    </div>
  );
}
