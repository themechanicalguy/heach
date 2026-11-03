'use client';

import { normalizeDigits } from '@heach/i18n';
import { useRef, useState } from 'react';
import { Button, Notice, TextField } from '@heach/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n-context';
import { usePending } from '../../lib/use-pending';
import { isService, PIN_PATTERN, type Service } from '../care/services';

/** Confidential PIN stays in memory and POST bodies. Results contain Public service names only. */
export function CoverageCheck() {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const generation = useRef(0);
  const [services, setServices] = useState<Service[] | undefined>();
  const [invalid, setInvalid] = useState(false);
  const { pending, error, run } = usePending();
  const check = () => {
    setInvalid(!PIN_PATTERN.test(pin));
    if (!PIN_PATTERN.test(pin)) return;
    const current = ++generation.current;
    void run(async () => {
      const result = await api<{ services: string[] }>('/coverage', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      if (current === generation.current) setServices(result.services.filter(isService));
    });
  };
  return (
    <form
      className="care-finder"
      onSubmit={(event) => {
        event.preventDefault();
        check();
      }}
    >
      <TextField
        label={t('search.pin')}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        value={pin}
        error={invalid ? t('search.pinInvalid') : undefined}
        onChange={(event) => {
          generation.current += 1;
          setPin(normalizeDigits(event.currentTarget.value.trim()));
          setServices(undefined);
        }}
      />
      <Button type="submit" disabled={pending}>
        {t('site.checkCoverage')}
      </Button>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
      {services && (
        <div role="status">
          <p>{t(services.length ? 'site.coverageServed' : 'site.coverageUnserved')}</p>
          <ul>
            {services.map((service) => (
              <li key={service}>{t(`services.${service}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
