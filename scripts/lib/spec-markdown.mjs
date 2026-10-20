// Small Markdown readers shared by the spec checks (ADR 0011). They read structure only.

const CRITERION_ROW = /^\|\s*([A-Z][A-Z0-9]*-\d{2}\.\d+)\s*\|/;
const REQUIREMENT_ROW = /^\|\s*([A-Z][A-Z0-9]*-\d{2})\s*\|/;

/** Body of the first heading that starts with `title` at `level`, up to the next heading at that level or above. */
export function section(markdown, level, title) {
  const lines = markdown.split('\n');
  const marker = `${'#'.repeat(level)} `;
  const start = lines.findIndex((line) => line.startsWith(marker + title));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,6} /.test(line) && line.indexOf(' ') <= level);
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Table rows of a section, without the header and separator rows. */
export function tableRows(body) {
  const rows = (body ?? '').split('\n').filter((line) => /^\|/.test(line));
  return rows.slice(2).filter((line) => !/^\|\s*-/.test(line));
}

/** Criterion IDs (`EN-03.1`) that start a table row, in order. */
export function criterionIds(body) {
  return (body ?? '')
    .split('\n')
    .map((line) => CRITERION_ROW.exec(line)?.[1])
    .filter(Boolean);
}

/** Requirement IDs (`EN-03`) that start a table row, as in the requirements document. */
export function requirementIds(markdown) {
  return new Set(
    markdown
      .split('\n')
      .map((line) => REQUIREMENT_ROW.exec(line)?.[1])
      .filter(Boolean),
  );
}

/** The word after `**Status**:` (feature specs) or `**Status:**` (step specs). */
export function status(markdown) {
  return /\*\*Status(?:\*\*:|:\*\*)\s*([A-Za-z]+)/.exec(markdown)?.[1];
}

/** The requirement ID a criterion belongs to: `EN-03.1` → `EN-03`. */
export function requirementOf(criterionId) {
  return criterionId.replace(/\.\d+$/, '');
}
