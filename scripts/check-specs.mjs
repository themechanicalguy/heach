// SO-01.1: every step spec has a filled threat model section, as the spec template requires.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/** Problems in one spec's Markdown: missing section, or a section with no threat rows. */
export function specProblems(name, markdown) {
  const section = /^## Threat model[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(markdown);
  if (!section) return [`${name}: no "## Threat model" section (SO-01.1)`];
  const rows = section[1].split('\n').filter((line) => /^\|/.test(line) && !/^\|\s*-/.test(line));
  return rows.length < 2 ? [`${name}: threat model has no threats (SO-01.1)`] : [];
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const dir = 'docs/specs';
  const problems = readdirSync(dir)
    .filter((name) => /^step-.*\.md$/.test(name))
    .flatMap((name) => specProblems(name, readFileSync(join(dir, name), 'utf8')));
  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Every step spec has a threat model\n');
}
