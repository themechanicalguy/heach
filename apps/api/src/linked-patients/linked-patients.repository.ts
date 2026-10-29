import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { type TransactionClient, withTransaction } from '../data-stores/transaction.js';
import type { LinkedPatientDto, LinkedPatientInputDto } from './linked-patients.dto.js';

const COLUMNS = `id, full_name AS "fullName", birth_year AS "birthYear", gender, relationship`;

/**
 * Linked patients (AC-03). Every statement names the owner: a profile of another account is
 * never read or changed, whatever ID the request carries (SE-02).
 */
@Injectable()
export class LinkedPatientsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  transaction<T>(work: (client: TransactionClient) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, work);
  }

  async list(ownerId: string): Promise<LinkedPatientDto[]> {
    const { rows } = await this.pool.query<LinkedPatientDto>(
      `SELECT ${COLUMNS} FROM app.linked_patient WHERE owner_account_id = $1 ORDER BY created_at`,
      [ownerId],
    );
    return rows;
  }

  /** Counts under the owner's account lock, so two concurrent adds cannot pass the cap. */
  async countLocked(client: TransactionClient, ownerId: string): Promise<number> {
    await client.query('SELECT 1 FROM app.account WHERE id = $1 FOR UPDATE', [ownerId]);
    const { rows } = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM app.linked_patient WHERE owner_account_id = $1',
      [ownerId],
    );
    return rows[0]?.n ?? 0;
  }

  async create(client: TransactionClient, ownerId: string, input: LinkedPatientInputDto) {
    const id = randomUUID();
    await client.query(
      `INSERT INTO app.linked_patient
         (id, owner_account_id, full_name, birth_year, gender, relationship)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, ownerId, input.fullName, input.birthYear, input.gender, input.relationship],
    );
    return id;
  }

  async update(
    client: TransactionClient,
    ownerId: string,
    id: string,
    input: LinkedPatientInputDto,
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE app.linked_patient
          SET full_name = $3, birth_year = $4, gender = $5, relationship = $6, updated_at = now()
        WHERE id = $1 AND owner_account_id = $2`,
      [id, ownerId, input.fullName, input.birthYear, input.gender, input.relationship],
    );
    return result.rowCount === 1;
  }

  async remove(client: TransactionClient, ownerId: string, id: string): Promise<boolean> {
    const result = await client.query(
      'DELETE FROM app.linked_patient WHERE id = $1 AND owner_account_id = $2',
      [id, ownerId],
    );
    return result.rowCount === 1;
  }
}
