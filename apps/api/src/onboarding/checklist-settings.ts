import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import { reason } from '../common/error-response.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import {
  CHECKLISTS,
  type ChecklistItem,
  ONBOARDING_ROLES,
  type OnboardingRole,
} from './checklists.js';

/** Police verification stays required for everyone who visits a home (owner decision Q-POLICE). */
const FIXED_REQUIRED = new Set(['police_verification']);

/**
 * Which checklist documents are required, per provider type (PO-01, AD-08): the items come from
 * code with their defaults; operations staff change whether each is required without a deploy.
 */
@Injectable()
export class ChecklistSettings {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async for(role: OnboardingRole): Promise<ChecklistItem[]> {
    const { rows } = await this.pool.query<{ key: string; required: boolean }>(
      'SELECT item_key AS key, required FROM app.checklist_setting WHERE role = $1',
      [role],
    );
    const changed = new Map(rows.map((row) => [row.key, row.required]));
    return CHECKLISTS[role].map((entry) => ({
      ...entry,
      required: changed.get(entry.key) ?? entry.required,
    }));
  }

  async all(): Promise<{ role: OnboardingRole; items: (ChecklistItem & { fixed: boolean })[] }[]> {
    return Promise.all(
      ONBOARDING_ROLES.map(async (role) => ({
        role,
        items: (await this.for(role)).map((entry) => ({
          ...entry,
          fixed: FIXED_REQUIRED.has(entry.key),
        })),
      })),
    );
  }

  async set(role: string, key: string, required: boolean): Promise<void> {
    const known = (ONBOARDING_ROLES as readonly string[]).includes(role)
      ? CHECKLISTS[role as OnboardingRole].some((entry) => entry.key === key)
      : false;
    if (!known) throw new NotFoundException();
    if (FIXED_REQUIRED.has(key) && !required)
      throw reason(BadRequestException, 'checklist_item_fixed');
    await this.pool.query(
      `INSERT INTO app.checklist_setting (role, item_key, required) VALUES ($1, $2, $3)
       ON CONFLICT (role, item_key) DO UPDATE SET required = EXCLUDED.required, updated_at = now()`,
      [role, key, required],
    );
  }
}
