import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  /** success: done or matched; warning: waiting; danger: failed or refused; info and neutral. */
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | undefined;
}

/** A compact status pill (design reference, admin A: identity results and statuses). */
export function Badge({ children, tone = 'neutral' }: Readonly<BadgeProps>) {
  return <span className={`heach-badge heach-badge--${tone}`}>{children}</span>;
}
