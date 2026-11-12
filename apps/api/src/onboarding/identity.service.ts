import { randomUUID } from 'node:crypto';
import type { EncryptedField, FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IDENTITY_CONSENT } from '../accounts/consent-versions.js';
import {
  IDENTITY_VERIFIER,
  type IdentityResult,
  type IdentityVerifier,
  type VerifiedAttributes,
} from '../adapters/identity.port.js';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { withTimeout } from '../common/with-timeout.js';
import { EnvVars } from '../config/env.schema.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { ApplicationGate } from './application-gate.js';
import type {
  IdentityCompleteDto,
  IdentityDetailsDto,
  IdentityDocumentDto,
  IdentityStartDto,
} from './onboarding.dto.js';
import { namesMatch } from './name-match.js';
import { OnboardingRepository } from './onboarding.repository.js';
import { ProfileRepository } from './profile.repository.js';
import { ProfileService } from './profile.service.js';
import { type PreparedShare, SharedDocumentsService } from './shared-documents.service.js';

const ENTITY = 'provider_application';
/** How long the partner may take before the provider is offered a retry or the fallback (KY-08). */
export const IDENTITY_TIMEOUT_MS = 10_000;

/**
 * The provider's identity check (KY-01, KY-05, KY-07, KY-08): consent first, then either the
 * partner's Aadhaar or DigiLocker check or, as a fallback, another identity document that a
 * verifier reviews. The Aadhaar number never reaches us.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly onboarding: OnboardingRepository,
    private readonly gate: ApplicationGate,
    private readonly uploads: UploadsService,
    private readonly shared: SharedDocumentsService,
    private readonly profiles: ProfileService,
    private readonly photos: ProfileRepository,
    private readonly audit: AuditService,
    private readonly env: EnvVars,
    @Inject(IDENTITY_VERIFIER) private readonly identity: IdentityVerifier,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async start(principal: Principal, input: IdentityStartDto): Promise<{ redirectUrl: string }> {
    assertConsent(input.consentVersion);
    const reference = randomUUID();
    const replaced = await this.gate.editable(principal.userId, async (client) => {
      await this.consent(client, principal.userId, input.locale);
      await this.record('identity.started', principal.userId, client);
      await this.photos.unlockPhoto(client, principal.userId);
      return this.onboarding.startIdentity(client, principal.userId, reference);
    });
    if (replaced) await this.uploads.discard(replaced);
    const returnUrl = `${this.env.WEB_ORIGIN}/${input.locale}/provider/onboarding/identity`;
    return this.partner(this.identity.startConsent(reference, returnUrl));
  }

  async complete(principal: Principal, input: IdentityCompleteDto): Promise<void> {
    const result = await this.partner(this.identity.completeConsent(input.code));
    const attributes = result.verified ? result.attributes : undefined;
    const detail = await this.encrypt(detailOf(result));
    const verifiedDetails = attributes ? await this.encrypt(restrictedOf(attributes)) : null;
    const shares = await this.shares(principal.userId, result);
    const photo = attributes?.photo
      ? await this.profiles.prepareVerified(principal.userId, attributes.photo)
      : undefined;
    const discard = await this.gate.editable(principal.userId, async (client) => {
      const typed = await this.onboarding.fullName(principal.userId, client);
      const finished = await this.onboarding.finishIdentity(
        client,
        principal.userId,
        input.reference,
        {
          verified: result.verified,
          method: result.documentType,
          detail,
          verifiedDetails,
          nameMatch: attributes ? nameMatchOf(typed, attributes.fullName) : null,
        },
      );
      if (!finished) throw reason(ConflictException, 'identity_not_pending');
      if (attributes)
        await this.onboarding.prefillProfile(client, principal.userId, profileOf(attributes));
      const action = result.verified ? 'identity.verified' : 'identity.failed';
      await this.record(action, principal.userId, client);
      const discard = await this.shared.save(client, principal.userId, shares);
      const replaced =
        photo && (await this.profiles.setPhoto(client, principal.userId, photo, true));
      return replaced ? [...discard, replaced] : discard;
    });
    await this.shared.discard(discard);
  }

  /** Issued documents shared with a verified result, scanned and stored before the transaction. */
  private async shares(accountId: string, result: IdentityResult): Promise<PreparedShare[]> {
    if (!result.verified || !result.documents?.length) return [];
    const { role } = await this.gate.grantOf(accountId);
    return this.shared.prepare(accountId, role, result.documents);
  }

  /** The provider's own verified details (KY-03); admins never get them from here. */
  async details(principal: Principal): Promise<IdentityDetailsDto> {
    await this.gate.grantOf(principal.userId);
    const stored = await this.onboarding.verifiedDetails(principal.userId);
    if (!stored) throw new NotFoundException();
    await this.audit.record({
      action: `${ENTITY}.identity.details_read`,
      entity: ENTITY,
      entityId: principal.userId,
    });
    return JSON.parse(await this.encryptor.decrypt(stored)) as IdentityDetailsDto;
  }

  /** The fallback (KY-07): the document is stored encrypted and waits for a verifier. */
  async uploadDocument(principal: Principal, input: IdentityDocumentDto): Promise<void> {
    assertConsent(input.consentVersion);
    const prepared = await this.uploads.prepare(principal.userId, 'provider_document', input);
    const replaced = await this.gate.editable(principal.userId, async (client) => {
      await this.uploads.record(client, prepared);
      if (prepared.verdict === 'infected') return undefined;
      await this.consent(client, principal.userId, input.locale);
      await this.record('identity.document_uploaded', principal.userId, client);
      await this.photos.unlockPhoto(client, principal.userId);
      return this.onboarding.saveIdentityDocument(client, principal.userId, {
        reference: randomUUID(),
        objectId: prepared.id,
        kind: input.kind,
      });
    });
    if (replaced) await this.uploads.discard(replaced);
    if (prepared.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
  }

  /** A slow or failing partner becomes one stable error; the provider retries or uses the fallback. */
  private async partner<T>(call: Promise<T>): Promise<T> {
    try {
      return await withTimeout(call, IDENTITY_TIMEOUT_MS);
    } catch {
      throw reason(ServiceUnavailableException, 'identity_unavailable');
    }
  }

  private encrypt(value: object): Promise<EncryptedField> {
    return this.encryptor.encrypt(JSON.stringify(value), 'identity');
  }

  private consent(client: TransactionClient, accountId: string, locale: string): Promise<void> {
    return this.onboarding.recordIdentityConsent(client, accountId, IDENTITY_CONSENT, locale);
  }

  private record(action: string, accountId: string, client: TransactionClient): Promise<void> {
    return this.audit.record(
      { action: `${ENTITY}.${action}`, entity: ENTITY, entityId: accountId },
      client,
    );
  }
}

/** The consent text the provider read must be the one in force (PR-01, decision L-12). */
function assertConsent(version: string): void {
  if (version !== IDENTITY_CONSENT.version) throw reason(ConflictException, 'consent_outdated');
}

/** What is kept of the partner's answer besides the result and time (KY-05). */
function detailOf(result: IdentityResult) {
  return { lastFour: result.lastFour ?? null, transactionId: result.transactionId };
}

/** Date of birth and address: Restricted, so kept encrypted and shown to the provider only. */
function restrictedOf(attributes: VerifiedAttributes) {
  return { dateOfBirth: attributes.dateOfBirth, address: attributes.address };
}

/** The verified name and gender as the profile stores them (name at most 100 characters). */
function profileOf(attributes: VerifiedAttributes) {
  return { fullName: attributes.fullName.trim().slice(0, 100), gender: attributes.gender };
}

/** A differing name is flagged for the verifier; nothing typed at sign-up is kept (KY-04). */
function nameMatchOf(typed: string | null, verified: string): 'match' | 'mismatch' {
  return typed !== null && namesMatch(typed, verified) ? 'match' : 'mismatch';
}
