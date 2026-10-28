'use client';

import { CheckboxField, Notice } from '@heach/ui';
import type { Consent } from '@heach/types';
import { useI18n } from '../../lib/i18n-context';

const TEXT = {
  terms: { label: 'setup.consent.terms', summary: 'setup.consent.termsSummary' },
  privacy: { label: 'setup.consent.privacy', summary: 'setup.consent.privacySummary' },
} as const;

interface Props {
  due: readonly Consent[];
  accepted: ReadonlySet<string>;
  showMissing: boolean;
  onToggle: (purpose: string, checked: boolean) => void;
}

/**
 * One choice per purpose, each with its plain-language text in the user's language (PR-01). The
 * texts are drafts until the lawyer's review (FU-06), and say so.
 */
export function ConsentItems({ due, accepted, showMissing, onToggle }: Readonly<Props>) {
  const { t } = useI18n();
  return (
    <>
      <Notice tone="warning">{t('setup.consent.draft')}</Notice>
      {due.map(({ purpose }) => (
        <div key={purpose} className="consent-item">
          <p className="consent-item__summary">{t(TEXT[purpose].summary)}</p>
          <CheckboxField
            label={t(TEXT[purpose].label)}
            checked={accepted.has(purpose)}
            error={showMissing && !accepted.has(purpose) ? t('setup.consent.required') : undefined}
            onChange={(event) => {
              onToggle(purpose, event.target.checked);
            }}
          />
        </div>
      ))}
    </>
  );
}

/** Which purposes are ticked; a helper so both consent screens share the logic. */
export function toggled(set: ReadonlySet<string>, purpose: string, checked: boolean): Set<string> {
  const next = new Set(set);
  if (checked) next.add(purpose);
  else next.delete(purpose);
  return next;
}
