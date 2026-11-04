import { Badge, type BadgeProps } from '@heach/ui';
import type { ApplicationSummary } from '@heach/types';
import { t } from '../i18n';
import { label } from './labels';
import { waitingDays, waitingTone } from './waiting';

const IDENTITY_TONE: Record<ApplicationSummary['identity'], BadgeProps['tone']> = {
  not_started: 'neutral',
  pending: 'warning',
  verified: 'success',
  failed: 'danger',
};

const STATUS_TONE: Record<ApplicationSummary['status'], BadgeProps['tone']> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

/** The identity check's result as a coloured pill with its words (G17, G19). */
export function IdentityBadge({
  identity,
}: Readonly<{ identity: ApplicationSummary['identity'] }>) {
  return (
    <Badge tone={IDENTITY_TONE[identity]}>{label('verification.identityStates', identity)}</Badge>
  );
}

export function StatusBadge({ status }: Readonly<{ status: ApplicationSummary['status'] }>) {
  return <Badge tone={STATUS_TONE[status]}>{label('verification.statuses', status)}</Badge>;
}

/** How long an application has waited, as a pill that warms with age. */
export function WaitingBadge({ submittedAt }: Readonly<{ submittedAt: string | null }>) {
  const days = waitingDays(submittedAt);
  if (days === null) return <>—</>;
  return (
    <Badge tone={waitingTone(days)}>
      {days === 0 ? t('verification.waitingToday') : t('verification.waitingDays', { days })}
    </Badge>
  );
}

/** A provider type or document key as admins read it, never the raw code (G19). */
export const roleName = (role: string) => label('checklists.roles', role);
export const documentName = (key: string) => label('checklists.items', key);
