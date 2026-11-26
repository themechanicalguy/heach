'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '../../lib/i18n-context';

/**
 * Lists what needs fixing and takes focus, so screen readers hear it first (A11Y-04). Focus moves
 * only when the list itself changes: callers rebuild the array on every render, and refocusing
 * then pulled focus out of the field on each keystroke after a failed submit.
 */
export function ErrorSummary({ messages }: Readonly<{ messages: readonly string[] }>) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const content = messages.join('\n');
  useEffect(() => {
    if (content) ref.current?.focus();
  }, [content]);
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
