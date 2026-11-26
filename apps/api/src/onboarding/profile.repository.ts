import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { TransactionClient } from '../data-stores/transaction.js';

type Queryable = Pick<pg.Pool, 'query'>;

export interface ProfileRow {
  qualifications: string | null;
  experienceYears: number | null;
  photoObjectId: string | null;
  photoVerified: boolean;
}

const EMPTY: ProfileRow = {
  qualifications: null,
  experienceYears: null,
  photoObjectId: null,
  photoVerified: false,
};

/** A provider's public profile details and photo (PO-05); every statement names the account. */
@Injectable()
export class ProfileRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async find(accountId: string, client: Queryable = this.pool): Promise<ProfileRow> {
    const { rows } = await client.query<ProfileRow>(
      `SELECT qualifications, experience_years AS "experienceYears",
              photo_object_id AS "photoObjectId", photo_verified AS "photoVerified"
         FROM app.provider_profile WHERE account_id = $1`,
      [accountId],
    );
    return rows[0] ?? EMPTY;
  }

  async saveDetails(
    client: TransactionClient,
    accountId: string,
    details: { qualifications: string | null; experienceYears: number | null },
  ): Promise<void> {
    await client.query(
      `INSERT INTO app.provider_profile (account_id, qualifications, experience_years)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET qualifications = EXCLUDED.qualifications,
         experience_years = EXCLUDED.experience_years, updated_at = now()`,
      [accountId, details.qualifications, details.experienceYears],
    );
  }

  /** Sets the photo and returns the stored object it replaced, if any. */
  async savePhoto(
    client: TransactionClient,
    accountId: string,
    photo: { objectId: string; verified: boolean },
  ): Promise<string | undefined> {
    const replaced = (await this.find(accountId, client)).photoObjectId ?? undefined;
    await client.query(
      `INSERT INTO app.provider_profile (account_id, photo_object_id, photo_verified)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET photo_object_id = EXCLUDED.photo_object_id,
         photo_verified = EXCLUDED.photo_verified, updated_at = now()`,
      [accountId, photo.objectId, photo.verified],
    );
    return replaced;
  }

  /** A new identity check lets the provider change the photo again (KY-03). */
  async unlockPhoto(client: TransactionClient, accountId: string): Promise<void> {
    await client.query(
      'UPDATE app.provider_profile SET photo_verified = false WHERE account_id = $1',
      [accountId],
    );
  }
}
