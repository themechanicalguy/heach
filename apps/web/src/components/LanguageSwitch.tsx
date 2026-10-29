'use client';

import { type Locale, LOCALES } from '@heach/i18n';
import { Icon } from '@heach/ui';
import { usePathname } from 'next/navigation';
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAccount } from '../lib/account';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n-context';

/** Closes an open disclosure on Escape (focus back to its button) or a press outside it. */
function useDismiss(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, root, button]);
}

/**
 * The language in a compact pill that opens the three choices, each labelled in its own language
 * and linking to the same page. Signed in, the choice is also kept on the account, so SMS and the
 * next sign-in use it (AC-02).
 */
export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const { account } = useAccount();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const rest = usePathname().split('/').slice(2).join('/');
  const suffix = rest ? `/${rest}` : '';
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useDismiss(open, close, root, button);
  const remember = (code: Locale) => {
    if (account.state !== 'ready' || code === locale) return;
    void api('/me/locale', {
      method: 'PUT',
      body: JSON.stringify({ locale: code }),
      keepalive: true,
    }).catch(() => undefined);
  };
  return (
    <nav aria-label={t('locale.label')} className="language-switch" ref={root}>
      <button
        ref={button}
        type="button"
        className="header-pill"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name="globe" size={18} />
        <span lang={locale} className="language-switch__name">
          {t(`locale.${locale}`)}
        </span>
        <Icon name="chevron-down" size={16} />
      </button>
      <ul id={listId} className="language-switch__list" hidden={!open}>
        {LOCALES.map((code) => (
          <li key={code}>
            <a
              href={`/${code}${suffix}`}
              lang={code}
              hrefLang={code}
              aria-current={code === locale ? 'true' : undefined}
              onClick={() => {
                remember(code);
                setOpen(false);
              }}
            >
              {t(`locale.${code}`)}
              {code === locale && <Icon name="check" size={18} />}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
