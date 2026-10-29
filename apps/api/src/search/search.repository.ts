import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import type { ProfileListingDto, SearchQueryDto, SearchResultDto } from './search.dto.js';

export type SearchRow = Omit<SearchResultDto, 'earliestSlot'>;

// Approved, active providers only (scope: verification before any listing). A lab is shown by
// its organisation's name, a person by their own.
const PUBLISHED = `
  JOIN app.role_assignment r ON r.account_id = l.provider_account_id AND r.side = 'provider'
       AND r.application_status = 'approved'
  JOIN app.account a ON a.id = l.provider_account_id AND a.status = 'active'
  JOIN app.account_profile p ON p.account_id = l.provider_account_id
  LEFT JOIN app.organisation o ON o.owner_account_id = l.provider_account_id
  LEFT JOIN app.provider_schedule s ON s.account_id = l.provider_account_id
  LEFT JOIN LATERAL (SELECT round(avg(v.stars)::numeric, 1)::float AS rating, count(*)::int AS n
                       FROM app.review v WHERE v.provider_account_id = l.provider_account_id
                        AND NOT v.hidden) rv ON true`;

const RESULT_COLUMNS = `l.id AS "listingId", l.provider_account_id AS "providerId",
  coalesce(o.name, p.full_name) AS name, r.role, p.gender, p.languages,
  i.code AS "itemCode", t.name AS "itemName", i.kind, i.prescription_required AS "prescriptionRequired",
  l.fee_paise AS "feePaise", coalesce(s.travel_surcharge_paise, 0) AS "travelSurchargePaise",
  l.duration_minutes AS "durationMinutes", rv.rating, rv.n AS "ratingCount"`;

/** Public search and profiles (SD-02 to SD-05): Public data of Approved providers only. */
@Injectable()
export class SearchRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  async search(query: SearchQueryDto): Promise<SearchRow[]> {
    const text = query.q ? `%${query.q.toLowerCase().replaceAll(/[%_\\]/g, '')}%` : null;
    const { rows } = await this.pool.query<SearchRow>(
      `SELECT ${RESULT_COLUMNS}
         FROM app.listing l
         JOIN app.catalogue_item i ON i.id = l.item_id AND i.active
         JOIN app.catalogue_item_text t ON t.item_id = i.id AND t.locale = $1
         ${PUBLISHED}
        WHERE l.active AND i.service = $2 AND ($3::text IS NULL OR i.code = $3)
          AND EXISTS (SELECT 1 FROM app.service_area sa JOIN app.pin_code pc ON pc.pin = sa.pin
                       WHERE sa.account_id = l.provider_account_id AND sa.pin = $4 AND pc.serviceable)
          AND ($5::text IS NULL OR p.gender = $5)
          AND ($6::text IS NULL OR $6 = ANY (p.languages))
          AND ($7::int IS NULL OR l.fee_paise <= $7)
          AND ($8::text IS NULL OR lower(coalesce(o.name, p.full_name)) LIKE $8
               OR EXISTS (SELECT 1 FROM app.catalogue_item_text tt
                           WHERE tt.item_id = i.id AND tt.search_name LIKE $8))
          AND ($9::int IS NULL OR rv.rating >= $9)
        ORDER BY l.fee_paise
        LIMIT 50`,
      [
        query.locale ?? 'or',
        query.service,
        query.item ?? null,
        query.pin,
        query.gender ?? null,
        query.language ?? null,
        query.maxFeePaise ?? null,
        text,
        query.minRating ?? null,
      ],
    );
    return rows;
  }

  async profile(providerId: string, locale: string) {
    const { rows } = await this.pool.query<
      ProfileListingDto &
        Pick<
          SearchResultDto,
          | 'name'
          | 'role'
          | 'gender'
          | 'languages'
          | 'travelSurchargePaise'
          | 'rating'
          | 'ratingCount'
        >
    >(
      `SELECT ${RESULT_COLUMNS}, t.preparation
         FROM app.listing l
         JOIN app.catalogue_item i ON i.id = l.item_id AND i.active
         JOIN app.catalogue_item_text t ON t.item_id = i.id AND t.locale = $2
         ${PUBLISHED}
        WHERE l.active AND l.provider_account_id = $1
        ORDER BY i.sort_order`,
      [providerId, locale],
    );
    return rows;
  }

  async publicFacts(providerId: string) {
    const { rows } = await this.pool.query<{
      identityVerified: boolean;
      registrationNumber: string | null;
    }>(
      `SELECT EXISTS (SELECT 1 FROM app.identity_check c WHERE c.account_id = $1 AND c.status = 'verified') AS "identityVerified",
              (SELECT d.reference FROM app.provider_document d
                WHERE d.account_id = $1 AND d.item = 'nursing_registration' AND d.review_status <> 'rejected') AS "registrationNumber"`,
      [providerId],
    );
    return rows[0] ?? { identityVerified: false, registrationNumber: null };
  }

  async pins(providerId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ pin: string }>(
      'SELECT pin FROM app.service_area WHERE account_id = $1 ORDER BY pin',
      [providerId],
    );
    return rows.map((row) => row.pin);
  }
}
