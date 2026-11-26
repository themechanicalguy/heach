import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { TransactionClient } from '../data-stores/transaction.js';
import {
  type PreparedUpload,
  type StoredFile,
  type UploadInput,
  UploadsService,
} from '../uploads/uploads.service.js';
import { ApplicationGate } from './application-gate.js';
import type { ProviderProfileDetailsDto, ProviderProfileInputDto } from './onboarding.dto.js';
import { ProfileRepository, type ProfileRow } from './profile.repository.js';

const ENTITY = 'provider_profile';
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

/**
 * The provider's public profile details and photo (PO-05). They change only while the application
 * is editable, so a verifier has seen what is published. A photo that came from the identity
 * check cannot be replaced without a new check (KY-03).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly gate: ApplicationGate,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
  ) {}

  async view(accountId: string): Promise<ProviderProfileDetailsDto> {
    return toView(await this.profiles.find(accountId));
  }

  async own(accountId: string): Promise<ProviderProfileDetailsDto> {
    await this.gate.grantOf(accountId);
    return this.view(accountId);
  }

  async save(
    accountId: string,
    input: ProviderProfileInputDto,
  ): Promise<ProviderProfileDetailsDto> {
    await this.gate.editable(accountId, async (client) => {
      const qualifications = input.qualifications?.trim();
      await this.profiles.saveDetails(client, accountId, {
        qualifications: qualifications === '' ? null : (qualifications ?? null),
        experienceYears: input.experienceYears ?? null,
      });
      await this.record('saved', accountId, client);
    });
    return this.view(accountId);
  }

  async uploadPhoto(accountId: string, input: UploadInput): Promise<ProviderProfileDetailsDto> {
    if (!PHOTO_TYPES.includes(input.contentType)) {
      throw reason(UnprocessableEntityException, 'upload_type');
    }
    const prepared = await this.uploads.prepare(accountId, 'profile_photo', input);
    const replaced = await this.gate.editable(accountId, async (client) => {
      if ((await this.profiles.find(accountId, client)).photoVerified) {
        throw reason(ConflictException, 'identity_locked');
      }
      await this.uploads.record(client, prepared);
      if (prepared.verdict === 'infected') return undefined;
      return this.setPhoto(client, accountId, prepared, false);
    });
    if (replaced) await this.uploads.discard(replaced);
    if (prepared.verdict === 'infected') throw reason(BadRequestException, 'upload_infected');
    return this.view(accountId);
  }

  /** The photo the identity partner verified (KY-03), prepared before the caller's transaction. */
  prepareVerified(accountId: string, photo: UploadInput): Promise<PreparedUpload | undefined> {
    return this.uploads
      .prepare(accountId, 'profile_photo', photo)
      .then((upload) => (upload.verdict === 'clean' ? upload : undefined))
      .catch(() => undefined);
  }

  /** Records a prepared photo; returns the stored object it replaced. */
  async setPhoto(
    client: TransactionClient,
    accountId: string,
    upload: PreparedUpload,
    verified: boolean,
  ): Promise<string | undefined> {
    if (verified) await this.uploads.record(client, upload);
    const replaced = await this.profiles.savePhoto(client, accountId, {
      objectId: upload.id,
      verified,
    });
    await this.record(verified ? 'photo.verified' : 'photo.uploaded', accountId, client);
    return replaced;
  }

  /** The photo itself; the caller has already decided that the reader may see it. */
  async photo(accountId: string, options: { audit: boolean }): Promise<StoredFile> {
    const { photoObjectId } = await this.profiles.find(accountId);
    const file = photoObjectId && (await this.uploads.read(photoObjectId, options));
    if (!file) throw new NotFoundException();
    return file;
  }

  private record(action: string, accountId: string, client: TransactionClient): Promise<void> {
    return this.audit.record(
      { action: `${ENTITY}.${action}`, entity: ENTITY, entityId: accountId },
      client,
    );
  }
}

function toView(row: ProfileRow): ProviderProfileDetailsDto {
  return {
    qualifications: row.qualifications,
    experienceYears: row.experienceYears,
    hasPhoto: row.photoObjectId !== null,
    photoVerified: row.photoVerified,
  };
}
