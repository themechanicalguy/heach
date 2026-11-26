import type { Request } from 'express';
import type { AccountRecord } from '../accounts/account.repository.js';
import type { Principal } from '../common/request-context.js';
import { EDITABLE } from '../onboarding/application-rules.js';
import type { ApplicationDto } from '../onboarding/onboarding.dto.js';
import { clientAddress } from '../otp/otp-origin.js';
import type { OtpOrigin } from '../otp/otp.service.js';
import type { AssistedApplicationDto } from './assisted-onboarding.dto.js';

/** Provider types a support admin may set up (AD-12); a sample collector joins through a lab. */
export const ASSISTED_ROLES = ['physiotherapist', 'nurse', 'attendant', 'lab'] as const;
export type AssistedRole = (typeof ASSISTED_ROLES)[number];

/** How long a session stays open after the provider's consent. */
export const SESSION_MINUTES = 60;

/**
 * Throttling identity of an assisted code request: the per-device cap becomes a per-admin cap,
 * so one admin cannot send codes to many numbers (SE-08).
 */
export function assistedOrigin(admin: Principal, request: Request): OtpOrigin {
  return { deviceId: `admin:${admin.userId}`, address: clientAddress(request) };
}

export interface ConsentRefusal {
  status: 403 | 409;
  code: string;
}

type Refusable = Pick<AccountRecord, 'status' | 'deletionRequestedAt' | 'roles'>;

/** Why a verified number may not start an assisted session; null when it may (AD-12). */
export function consentRefusal(
  account: Refusable,
  isOffered: (role: string) => boolean,
): ConsentRefusal | null {
  if (account.status === 'suspended') return { status: 403, code: 'account_suspended' };
  if (account.deletionRequestedAt) return { status: 409, code: 'deletion_pending' };
  const grant = account.roles.find((role) => role.side === 'provider');
  if (!grant) return null;
  if (!isOffered(grant.role)) return { status: 409, code: 'role_unavailable' };
  if (!(ASSISTED_ROLES as readonly string[]).includes(grant.role)) {
    return { status: 409, code: 'role_not_assisted' };
  }
  const editable = grant.applicationStatus !== null && EDITABLE.includes(grant.applicationStatus);
  return editable ? null : { status: 409, code: 'application_not_editable' };
}

/**
 * What the assisting admin may see of an application: states and counts only. References,
 * expiry dates, issuers, payout holder and hint, and how identity was checked stay out (AD-12).
 */
export function toAssistedView(application: ApplicationDto): AssistedApplicationDto {
  return {
    role: application.role,
    status: application.status,
    statusReason: application.statusReason,
    identity: application.identity,
    identityConsentVersion: application.identityConsentVersion,
    profile: application.profile,
    needsPayout: application.needsPayout,
    payoutOnFile: application.payout !== null,
    items: application.items.map(({ key, required, reference, expiry, document }) => ({
      key,
      required,
      reference,
      expiry,
      document: document && {
        scanStatus: document.scanStatus,
        reviewStatus: document.reviewStatus,
        reviewReason: document.reviewReason,
        uploadedAt: document.uploadedAt,
        source: document.source,
      },
    })),
    missing: application.missing,
    editable: application.editable,
  };
}
