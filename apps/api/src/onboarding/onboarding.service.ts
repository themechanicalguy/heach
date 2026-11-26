import type { FieldEncryptor } from '@heach/crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import { FIELD_ENCRYPTOR } from '../crypto/crypto.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { ApplicationGate } from './application-gate.js';
import { canSubmit } from './application-rules.js';
import { ApplicationView } from './application-view.js';
import { checklistItem } from './checklists.js';
import type { ApplicationDto, DocumentUploadDto, PayoutDetailsDto } from './onboarding.dto.js';
import { OnboardingRepository } from './onboarding.repository.js';

const ENTITY = 'provider_application';

/** Who changes the application: the provider, or an admin acting for them (AD-12). */
export type Actor = Pick<Principal, 'userId' | 'role'>;

/**
 * The provider's own application (J1, PO-01 to PO-06): documents, identity, payout details and
 * submission; the identity check itself is in `IdentityService`. Changes are allowed only while the application is editable (PO-04).
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly onboarding: OnboardingRepository,
    private readonly gate: ApplicationGate,
    private readonly view: ApplicationView,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
    @Inject(FIELD_ENCRYPTOR) private readonly encryptor: FieldEncryptor,
  ) {}

  async application(accountId: string): Promise<ApplicationDto> {
    return this.view.build(accountId, await this.gate.grantOf(accountId));
  }

  async upload(accountId: string, item: string, input: DocumentUploadDto): Promise<ApplicationDto> {
    const grant = await this.gate.grantOf(accountId);
    const entry = checklistItem(grant.role, item);
    if (!entry) throw new NotFoundException();
    if (entry.reference && !input.reference)
      throw reason(BadRequestException, 'reference_required');
    if (entry.expiry && !input.expiresOn) throw reason(BadRequestException, 'expiry_required');
    const prepared = await this.uploads.prepare(accountId, 'provider_document', input);
    const replaced = await this.gate.editable(accountId, async (client) => {
      await this.uploads.record(client, prepared);
      const saved = await this.onboarding.saveDocument(client, accountId, {
        item,
        objectId: prepared.id,
        reference: entry.reference ? (input.reference ?? null) : null,
        expiresOn: entry.expiry ? (input.expiresOn ?? null) : null,
      });
      await this.audit.record(
        { action: 'provider_document.uploaded', entity: ENTITY, entityId: saved.id },
        client,
      );
      return saved.replacedObjectId;
    });
    if (replaced) await this.uploads.discard(replaced);
    if (prepared.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    return this.application(accountId);
  }

  async savePayout(accountId: string, input: PayoutDetailsDto): Promise<ApplicationDto> {
    const destination = (input.method === 'bank' ? input.accountNumber : input.upiId) ?? '';
    const encrypted = await this.encryptor.encrypt(destination, 'payments');
    await this.gate.editable(accountId, async (client) => {
      await this.onboarding.savePayout(client, accountId, {
        method: input.method,
        holderName: input.holderName,
        destination: encrypted,
        hint: destination.slice(-4),
        ifsc: input.method === 'bank' ? (input.ifsc ?? null) : null,
      });
      await this.record('payout_details.saved', accountId, client);
    });
    return this.application(accountId);
  }

  async submit(accountId: string, actor: Actor): Promise<ApplicationDto> {
    const current = await this.application(accountId);
    if (current.missing.length > 0) throw reason(ConflictException, 'application_incomplete');
    await this.onboarding.transaction(async (client) => {
      const grant = await this.gate.grantOf(accountId, client);
      if (!canSubmit(grant.status)) throw reason(ConflictException, 'application_not_editable');
      await this.onboarding.changeStatus(client, accountId, {
        from: grant.status,
        to: 'submitted',
        reason: null,
        actorId: actor.userId,
        actorRole: actor.role,
      });
      await this.record('submitted', accountId, client);
    });
    return this.application(accountId);
  }

  private record(action: string, accountId: string, client: TransactionClient): Promise<void> {
    return this.audit.record(
      { action: `${ENTITY}.${action}`, entity: ENTITY, entityId: accountId },
      client,
    );
  }
}
