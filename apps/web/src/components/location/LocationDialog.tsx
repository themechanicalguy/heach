'use client';

import { normalizeDigits } from '@heach/i18n';
import { Button, Sheet, TextField } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import {
  isLandingPage,
  markAsked,
  useActiveService,
  useIsCareAudience,
  useLocation,
  wasAsked,
} from '../../lib/location';
import { PIN_PATTERN, type Service } from '../care/services';
import { LocationResult } from './LocationResult';
import { ServiceChoice } from './ServiceChoice';

/** Opens once per visit on the pages people land on, if we do not know their PIN yet. */
function useAskOnLanding() {
  const pathname = usePathname();
  const { search, ready } = useCareSearch();
  const { openDialog } = useLocation();
  const audience = useIsCareAudience();
  useEffect(() => {
    if (!ready || !audience || search.pin || !isLandingPage(pathname) || wasAsked()) return;
    markAsked();
    openDialog();
  }, [ready, audience, search.pin, pathname, openDialog]);
}

function LocationForm({ onDone }: Readonly<{ onDone: () => void }>) {
  const { t } = useI18n();
  const { search, setSearch } = useCareSearch();
  const { status, recheck } = useLocation();
  const active = useActiveService();
  const [pin, setPin] = useState(search.pin);
  const [service, setService] = useState<Service>(active);
  const [invalid, setInvalid] = useState(false);
  const [asked, setAsked] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    // After the dialog has opened: a modal only accepts focus once it is showing.
    const frame = requestAnimationFrame(() => form.current?.querySelector('input')?.focus());
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  const submit = () => {
    const valid = PIN_PATTERN.test(pin);
    setInvalid(!valid);
    setAsked(valid);
    if (!valid) return;
    markAsked();
    if (pin === search.pin && status === 'error') recheck();
    setSearch({ ...search, pin, service });
  };
  return (
    <form
      ref={form}
      className="location-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="location-intro">{t('location.intro')}</p>
      <TextField
        label={t('location.pin')}
        hint={t('location.pinHint')}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        value={pin}
        error={invalid ? t('location.pinInvalid') : undefined}
        onChange={(event) => {
          setPin(normalizeDigits(event.currentTarget.value.trim()));
          setAsked(false);
        }}
      />
      <ServiceChoice
        value={service}
        onChange={(next) => {
          setService(next);
          setAsked(false);
        }}
      />
      <Button type="submit" disabled={asked && status === 'checking'}>
        {t('location.check')}
      </Button>
      {asked && <LocationResult pin={pin} service={service} onContinue={onDone} />}
    </form>
  );
}

/** "Where do you need care?": PIN and service, answered at once, never in the way (SD-04). */
export function LocationDialog() {
  const { t } = useI18n();
  const { dialogOpen, closeDialog } = useLocation();
  useAskOnLanding();
  const close = () => {
    markAsked();
    closeDialog();
  };
  return (
    <Sheet
      open={dialogOpen}
      title={t('location.title')}
      closeLabel={t('location.skip')}
      onClose={close}
    >
      {dialogOpen && <LocationForm onDone={close} />}
    </Sheet>
  );
}
