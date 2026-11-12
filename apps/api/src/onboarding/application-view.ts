import { Injectable } from '@nestjs/common';
import type { ApplicationStatus } from '../accounts/account.repository.js';
import { IDENTITY_CONSENT } from '../accounts/consent-versions.js';
import { EDITABLE, identityState, missingForSubmit } from './application-rules.js';
import { ChecklistSettings } from './checklist-settings.js';
import { needsPayout, type OnboardingRole } from './checklists.js';
import type { ApplicationDto, IdentityDocumentKind } from './onboarding.dto.js';
import { type DocumentRow, OnboardingRepository } from './onboarding.repository.js';

/** Today in India, as YYYY-MM-DD (AV-04: the service runs on IST only). */
export function todayInIndia(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** Builds the checklist hub a provider and a reviewer both see (PO-01, PO-04). */
@Injectable()
export class ApplicationView {
  constructor(
    private readonly onboarding: OnboardingRepository,
    private readonly checklists: ChecklistSettings,
  ) {}

  async build(
    accountId: string,
    grant: { role: OnboardingRole; status: ApplicationStatus; statusReason: string | null },
  ): Promise<ApplicationDto> {
    const [documents, identity, payout, checklist] = await Promise.all([
      this.onboarding.documents(accountId),
      this.onboarding.identity(accountId),
      this.onboarding.payout(accountId),
      this.checklists.for(grant.role),
    ]);
    const byItem = new Map(documents.map((row) => [row.item, row]));
    const state = identityState(identity);
    return {
      role: grant.role,
      status: grant.status,
      statusReason: grant.statusReason,
      identity: state,
      identityMethod: identity?.method ?? null,
      identityDocumentKind: (identity?.documentKind ?? null) as IdentityDocumentKind | null,
      identityConsentVersion: IDENTITY_CONSENT.version,
      identityNameMatch: identity?.nameMatch ?? null,
      identityDetailsVerified: identity?.nameMatch != null && state === 'verified',
      needsPayout: needsPayout(grant.role),
      payout: payout ?? null,
      items: checklist.map((entry) => ({
        ...entry,
        document: documentView(byItem.get(entry.key)),
      })),
      missing: missingForSubmit({
        role: grant.role,
        checklist,
        identityOnFile: state === 'verified' || state === 'in_review',
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
  const review = { reviewStatus, reviewReason };
  return {
    id,
    scanStatus,
    reference,
    expiresOn,
    ...review,
    uploadedAt,
    source: row.source,
    issuer: row.issuer,
  };
}

function cleanDocuments(rows: readonly DocumentRow[]) {
  return new Map(
    rows
      .filter((row) => row.scanStatus === 'clean' && row.reviewStatus !== 'rejected')
      .map((row) => [row.item, { reference: Boolean(row.reference), expiresOn: row.expiresOn }]),
  );
}
