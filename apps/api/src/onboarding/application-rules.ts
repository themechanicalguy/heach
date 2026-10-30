import type { ApplicationStatus } from '../accounts/account.repository.js';
import { type ChecklistItem, needsPayout, type OnboardingRole } from './checklists.js';

/** The provider may change their application only in these statuses (PO-03, PO-04). */
export const EDITABLE: readonly ApplicationStatus[] = ['draft', 'changes_requested'];

export type Decision = 'approve' | 'reject' | 'request_changes';

const DECIDED: Record<Decision, ApplicationStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
};

export interface ApplicationFacts {
  role: OnboardingRole;
  /** The role's checklist with today's required flags (AD-08). */
  checklist: readonly ChecklistItem[];
  identityVerified: boolean;
  payoutOnFile: boolean;
  /** Checklist keys with a clean document, and whether each has its reference and expiry. */
  documents: ReadonlyMap<string, { reference: boolean; expiresOn: string | null }>;
  today: string;
}

/** What still stops the provider from submitting, as stable keys the app translates. */
export function missingForSubmit(facts: ApplicationFacts): string[] {
  const missing: string[] = [];
  if (!facts.identityVerified) missing.push('identity');
  for (const entry of facts.checklist) {
    const document = facts.documents.get(entry.key);
    if (!document) {
      if (entry.required) missing.push(entry.key);
      continue;
    }
    const expired = entry.expiry && (!document.expiresOn || document.expiresOn <= facts.today);
    if ((entry.reference && !document.reference) || expired) missing.push(entry.key);
  }
  if (needsPayout(facts.role) && !facts.payoutOnFile) missing.push('payout');
  return missing;
}

/** Submitting moves an editable application to Submitted; anything else is refused. */
export function canSubmit(status: ApplicationStatus): boolean {
  return EDITABLE.includes(status);
}

/** An admin opening a submitted application starts the review (PO-04). */
export function opensReview(status: ApplicationStatus): boolean {
  return status === 'submitted';
}

/** The status an admin's decision leads to, or undefined when no decision is allowed now. */
export function decide(
  status: ApplicationStatus,
  decision: Decision,
): ApplicationStatus | undefined {
  if (status !== 'submitted' && status !== 'under_review') return undefined;
  return DECIDED[decision];
}
