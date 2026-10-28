import type { ReactNode } from 'react';

export interface NoticeProps {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success' | undefined;
  /** Announce it when it appears (status changes); static notes stay silent. */
  live?: boolean | undefined;
}

/** A short note beside a form or status (design reference: the encrypted-details note). */
export function Notice({ children, tone = 'info', live = false }: Readonly<NoticeProps>) {
  return (
    <div className={`heach-notice heach-notice--${tone}`} role={live ? 'status' : undefined}>
      <div>{children}</div>
    </div>
  );
}
