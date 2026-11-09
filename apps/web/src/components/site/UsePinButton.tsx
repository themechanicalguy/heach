'use client';

import { useCareSearch } from '../../lib/care-search';
import type { Service } from '../care/services';

/** Puts a PIN from the serviceable list into the search form below it. */
export function UsePinButton({
  pin,
  service,
  label,
  ariaLabel,
}: Readonly<{ pin: string; service: Service; label: string; ariaLabel: string }>) {
  const { search, setSearch } = useCareSearch();
  return (
    <a
      className="heach-button heach-button--secondary"
      href="#find-care"
      aria-label={ariaLabel}
      onClick={() => {
        setSearch({ ...search, service, pin });
      }}
    >
      {label}
    </a>
  );
}
