'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '../../lib/i18n-context';

/** Lists what needs fixing and takes focus, so screen readers hear it first (A11Y-04). */
export function ErrorSummary({ messages }: Readonly<{ messages: readonly string[] }>) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length > 0) ref.current?.focus();
  }, [messages]);
  if (messages.length === 0) return null;
  return (
    <div ref={ref} className="heach-notice heach-notice--danger" role="alert" tabIndex={-1}>
      <div>
        <p className="flow__summary-title">{t('setup.errorSummary', { count: messages.length })}</p>
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
