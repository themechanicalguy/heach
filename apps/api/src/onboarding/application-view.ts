import { Injectable } from '@nestjs/common';
import type { ApplicationStatus } from '../accounts/account.repository.js';
import { EDITABLE, missingForSubmit } from './application-rules.js';
import { CHECKLISTS, needsPayout, type OnboardingRole } from './checklists.js';
import type { ApplicationDto, IdentityState } from './onboarding.dto.js';
import { type DocumentRow, OnboardingRepository } from './onboarding.repository.js';

/** Today in India, as YYYY-MM-DD (AV-04: the service runs on IST only). */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** Builds the checklist hub a provider and a reviewer both see (PO-01, PO-04). */
@Injectable()
export class ApplicationView {
  constructor(private readonly onboarding: OnboardingRepository) {}

  async build(
    accountId: string,
    grant: { role: OnboardingRole; status: ApplicationStatus; statusReason: string | null },
  ): Promise<ApplicationDto> {
    const [documents, identity, payout] = await Promise.all([
      this.onboarding.documents(accountId),
      this.onboarding.identity(accountId),
      this.onboarding.payout(accountId),
    ]);
    const byItem = new Map(documents.map((row) => [row.item, row]));
    const identityState = (identity?.status ?? 'not_started') as IdentityState;
    return {
      role: grant.role,
      status: grant.status,
      statusReason: grant.statusReason,
      identity: identityState,
      needsPayout: needsPayout(grant.role),
      payout: payout ?? null,
      items: CHECKLISTS[grant.role].map((entry) => ({
        ...entry,
        document: documentView(byItem.get(entry.key)),
      })),
      missing: missingForSubmit({
        role: grant.role,
        identityVerified: identityState === 'verified',
        payoutOnFile: Boolean(payout),
        documents: cleanDocuments(documents),
        today: todayInIndia(),
      }),
      editable: EDITABLE.includes(grant.status),
    };
  }
}

function documentView(row: DocumentRow | undefined) {
  if (!row) return null;
  const { id, scanStatus, reference, expiresOn, reviewStatus, reviewReason, uploadedAt } = row;
  return { id, scanStatus, reference, expiresOn, reviewStatus, reviewReason, uploadedAt };
}

function cleanDocuments(rows: readonly DocumentRow[]) {
  return new Map(
    rows
      .filter((row) => row.scanStatus === 'clean' && row.reviewStatus !== 'rejected')
      .map((row) => [row.item, { reference: Boolean(row.reference), expiresOn: row.expiresOn }]),
  );
}
