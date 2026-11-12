import { Injectable } from '@nestjs/common';
import type { SharedDocument } from '../adapters/identity.port.js';
import { AuditService } from '../audit/audit.service.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import { type PreparedUpload, UploadsService } from '../uploads/uploads.service.js';
import { ChecklistSettings } from './checklist-settings.js';
import type { OnboardingRole } from './checklists.js';
import { type DocumentInput, OnboardingRepository } from './onboarding.repository.js';
import { checklistItemFor } from './shared-documents.js';

const ENTITY = 'provider_application';

export interface PreparedShare {
  upload: PreparedUpload;
  document: DocumentInput;
}

/**
 * Documents the provider shared from DigiLocker with the identity check (KY-02). Each one that
 * fills an item on the role's checklist is scanned and stored encrypted like an upload, marked
 * as an issued copy; anything else is dropped unread.
 */
@Injectable()
export class SharedDocumentsService {
  constructor(
    private readonly onboarding: OnboardingRepository,
    private readonly checklists: ChecklistSettings,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
  ) {}

  /** Scans and stores the usable documents, outside any transaction; a bad file is skipped. */
  async prepare(
    accountId: string,
    role: OnboardingRole,
    documents: readonly SharedDocument[],
  ): Promise<PreparedShare[]> {
    const checklist = await this.checklists.for(role);
    const prepared = new Map<string, PreparedShare>();
    for (const document of documents) {
      const entry = checklistItemFor(document, checklist);
      if (!entry || prepared.has(entry.key)) continue;
      const upload = await this.uploads
        .prepare(accountId, 'provider_document', document)
        .catch(() => undefined);
      if (upload?.verdict !== 'clean') continue;
      prepared.set(entry.key, { upload, document: inputOf(entry, document, upload.id) });
    }
    return [...prepared.values()];
  }

  /** Records the copies in the caller's transaction; returns the stored objects to discard. */
  async save(
    client: TransactionClient,
    accountId: string,
    shares: readonly PreparedShare[],
  ): Promise<string[]> {
    const accepted = await this.onboarding.acceptedItems(client, accountId);
    const discard: string[] = [];
    for (const share of shares) {
      // A document a verifier has already accepted is left as it is.
      if (accepted.has(share.document.item)) {
        discard.push(share.upload.id);
        continue;
      }
      await this.uploads.record(client, share.upload);
      const saved = await this.onboarding.saveDocument(client, accountId, share.document);
      if (saved.replacedObjectId) discard.push(saved.replacedObjectId);
      await this.audit.record(
        { action: 'provider_document.shared', entity: ENTITY, entityId: saved.id },
        client,
      );
    }
    return discard;
  }

  async discard(objectIds: readonly string[]): Promise<void> {
    for (const id of objectIds) await this.uploads.discard(id);
  }
}

function inputOf(
  entry: { key: string; reference: boolean; expiry: boolean },
  document: SharedDocument,
  objectId: string,
): DocumentInput {
  return {
    item: entry.key,
    objectId,
    reference: entry.reference ? (document.reference ?? null) : null,
    expiresOn: entry.expiry ? (document.expiresOn ?? null) : null,
    issuer: document.issuer.trim().slice(0, 120),
  };
}
