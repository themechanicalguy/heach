import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATALOGUES, formatIcu, type Locale } from '@heach/i18n';
import type pg from 'pg';
import { reason } from '../common/error-response.js';
import type { Plain } from '../common/plain.js';
import { PG_POOL } from '../data-stores/data-stores.tokens.js';
import { CONTENT_LOCALES, type PageDto, type PageSlug, type TemplateDto } from './content.dto.js';

/** Sign-in and confirmation codes keep their fixed, reviewed wording (SE-01): never edited. */
const FIXED_PREFIX = 'otp_';

/** The placeholder names a template uses, such as `time` in `Ends {time}`. */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\s*([a-zA-Z]+)/g)].map((match) => match[1] ?? ''))].sort(
    (a, b) => a.localeCompare(b),
  );
}

/**
 * Content operations staff change without a deployment (AD-09): the text of notification
 * templates per language, and the static pages. An edited template keeps exactly the default's
 * placeholders and must parse, so a message can never lose the time or amount it has to carry.
 * A real SMS provider in India sends only registered templates: register an edit there first.
 */
@Injectable()
export class ContentService {
  constructor(@Inject(PG_POOL) private readonly pool: Pick<pg.Pool, 'query'>) {}

  editableTemplates(): string[] {
    return Object.keys(CATALOGUES.en.sms).filter((template) => !template.startsWith(FIXED_PREFIX));
  }

  async templates(): Promise<Plain<TemplateDto>[]> {
    const { rows } = await this.pool.query<{ template: string; locale: string; text: string }>(
      'SELECT template, locale, text FROM app.message_override',
    );
    const edited = new Map(rows.map((row) => [`${row.template}:${row.locale}`, row.text]));
    return this.editableTemplates().flatMap((template) =>
      CONTENT_LOCALES.map((locale) => {
        const defaultText = this.defaultText(template, locale);
        return {
          template,
          locale,
          defaultText,
          override: edited.get(`${template}:${locale}`) ?? null,
          placeholders: placeholdersOf(defaultText),
        };
      }),
    );
  }

  async setTemplate(template: string, locale: Locale, text: string | null): Promise<void> {
    if (!this.editableTemplates().includes(template)) throw new NotFoundException();
    if (text === null) {
      await this.pool.query(
        'DELETE FROM app.message_override WHERE template = $1 AND locale = $2',
        [template, locale],
      );
      return;
    }
    const expected = placeholdersOf(this.defaultText(template, locale));
    if (placeholdersOf(text).join() !== expected.join())
      throw reason(BadRequestException, 'template_placeholders');
    try {
      formatIcu(text, Object.fromEntries(expected.map((name) => [name, 'x'])), locale);
    } catch {
      throw reason(BadRequestException, 'template_invalid');
    }
    await this.pool.query(
      `INSERT INTO app.message_override (template, locale, text) VALUES ($1, $2, $3)
       ON CONFLICT (template, locale) DO UPDATE SET text = EXCLUDED.text, updated_at = now()`,
      [template, locale, text],
    );
  }

  async pages(): Promise<Plain<PageDto>[]> {
    const { rows } = await this.pool.query<Plain<PageDto>>(
      'SELECT slug, locale, title, body, updated_at AS "updatedAt" FROM app.content_page ORDER BY slug, locale',
    );
    return rows;
  }

  async page(slug: string, locale: Locale): Promise<Plain<PageDto>> {
    const { rows } = await this.pool.query<Plain<PageDto>>(
      `SELECT slug, locale, title, body, updated_at AS "updatedAt" FROM app.content_page
        WHERE slug = $1 AND locale = $2`,
      [slug, locale],
    );
    const page = rows[0];
    if (!page) throw new NotFoundException();
    return page;
  }

  async setPage(slug: PageSlug, locale: Locale, title: string, body: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO app.content_page (slug, locale, title, body) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug, locale) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()`,
      [slug, locale, title, body],
    );
  }

  private defaultText(template: string, locale: Locale): string {
    return (CATALOGUES[locale].sms as Record<string, string>)[template] ?? '';
  }
}
