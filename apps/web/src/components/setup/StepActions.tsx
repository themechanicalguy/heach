'use client';

import { Button } from '@heach/ui';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/i18n-context';
import { useHydrated } from '../../lib/use-hydrated';

interface Props {
  submitLabel: string;
  pending: boolean;
  /** Extra reason to hold the submit button, for example an incomplete code. */
  disabled?: boolean | undefined;
  /** Where Back goes; no Back button without it. */
  back?: string | undefined;
}

/**
 * The action bar of every sign-in and setup form: Back and the primary action, in the thumb zone
 * on phones (UX-03). The submit waits for hydration and is held while a request is in flight.
 */
export function StepActions({ submitLabel, pending, disabled = false, back }: Readonly<Props>) {
  const { t } = useI18n();
  const router = useRouter();
  const hydrated = useHydrated();
  return (
    <div className="flow__actions">
      {back && (
        <Button
          className="heach-button--secondary"
          onClick={() => {
            router.push(back);
          }}
        >
          {t('setup.back')}
        </Button>
      )}
      <Button
        type="submit"
        className="flow__primary"
        disabled={!hydrated || pending || disabled}
        aria-busy={pending}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
