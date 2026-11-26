import type { AuditEntryDto } from './audit-search.dto.js';

const COLUMNS = [
  'seq',
  'id',
  'at',
  'actorId',
  'actorRole',
  'action',
  'entity',
  'entityId',
  'correlationId',
] as const satisfies readonly (keyof AuditEntryDto)[];

const FORMULA_START = /^[=+\-@\t\r]/;

/** One quoted CSV cell; a leading formula character gets a single quote so sheets show text. */
export function csvCell(value: string | null): string {
  const text = value ?? '';
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** The audit entries as CSV with a header row and CRLF line ends (AD-11). */
export function auditCsv(entries: readonly AuditEntryDto[]): string {
  const lines = [COLUMNS.map((name) => csvCell(name)).join(',')];
  for (const entry of entries) {
    lines.push(COLUMNS.map((name) => csvCell(entry[name])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
