'use client';

import { Notice } from '@heach/ui';
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n-context';

// A bare flag: it carries no personal data and nothing about the application, and it lives only
// in this tab. The notice it triggers is shown once and the flag is removed.
const FLAG = 'heach.application-submitted';

export function rememberSubmitted(): void {
  try {
    window.sessionStorage.setItem(FLAG, '1');
  } catch {
    // Storage blocked: the home page simply shows no notice; the status stays on the application.
  }
}

function takeSubmitted(): boolean {
  try {
    const set = window.sessionStorage.getItem(FLAG) === '1';
    window.sessionStorage.removeItem(FLAG);
    return set;
  } catch {
    return false;
  }
}

/** One-time confirmation shown on the page a provider lands on right after submitting. */
export function ApplicationSubmittedNotice() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (takeSubmitted()) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div className="page">
      <Notice tone="success" live>
        {t('application.submittedNotice')}
      </Notice>
    </div>
  );
}
