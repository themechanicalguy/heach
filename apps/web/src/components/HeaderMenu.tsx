'use client';

import { Icon, type IconName } from '@heach/ui';
import { type ReactNode, useCallback, useId, useRef, useState } from 'react';
import { useDismiss } from '../lib/use-dismiss';

interface Props {
  label: string;
  icon: IconName;
  /** Below this width the label is read by screen readers only, so the header stays one row. */
  labelFrom?: 'always' | 'phone' | 'tablet';
  /** Show the open/closed chevron (for pickers whose label is the current choice). */
  chevron?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A header pill that opens a small panel of links or controls. Closes on Escape (focus returns to
 * the pill) or a press outside; its links load a new page.
 */
export function HeaderMenu({
  label,
  icon,
  labelFrom = 'always',
  chevron = false,
  className,
  children,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useDismiss(open, close, root, button);
  return (
    <div className={className ? `header-menu ${className}` : 'header-menu'} ref={root}>
      <button
        ref={button}
        type="button"
        className="header-pill"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name={icon} size={20} />
        <span className={`header-pill__label header-pill__label--${labelFrom}`}>{label}</span>
        {chevron && (
          <span className="header-pill__chevron">
            <Icon name="chevron-down" size={16} />
          </span>
        )}
      </button>
      <div id={panelId} className="header-menu__panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
