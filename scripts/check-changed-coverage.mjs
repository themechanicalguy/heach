// TS-01.1: fails when fewer than 80 percent of the instrumented lines a PR changes are covered.
// Usage: node scripts/check-changed-coverage.mjs <base-ref>
// Reads every coverage*/lcov.info under apps/ and packages/ (unit and integration runs), takes the
// union of hits, and compares with the lines added or changed since <base-ref>.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';

export const THRESHOLD = 0.8;

/** Source files the gate measures: app and package code, not tests, stories or route files. */
export function isMeasured(file) {
  return (
    /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx)$/.test(file) &&
    !/\.(test|spec|stories|d)\.tsx?$/.test(file) &&
    !/\/(generated|test)\//.test(file) &&
    // Next route files run only in Playwright (apps/web/e2e), not under coverage.
    !/\/app\/.*(page|layout|route)\.tsx?$/.test(file)
  );
}

/** { file: Set(changed line numbers) } from `git diff -U0` output. */
export function changedLines(diff) {
  const result = {};
  let file;
  for (const line of diff.split('\n')) {
    const name = /^\+\+\+ b\/(.+)$/.exec(line);
    if (name) file = name[1];
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file && isMeasured(file)) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      result[file] ??= new Set();
      for (let n = start; n < start + count; n += 1) result[file].add(n);
    }
  }
  return result;
}

/** Union of lcov line hits: { file: Map(line, hits) }, paths relative to `root`. */
export function parseLcov(texts, root) {
  const hits = {};
  for (const { text, dir } of texts) {
    let file;
    for (const line of text.split('\n')) {
      if (line.startsWith('SF:')) file = relative(root, resolve(dir, line.slice(3)));
      const da = /^DA:(\d+),(\d+)/.exec(line);
      if (da && file) {
        hits[file] ??= new Map();
        const n = Number(da[1]);
        hits[file].set(n, Math.max(hits[file].get(n) ?? 0, Number(da[2])));
      }
    }
  }
  return hits;
}

/** Covered and instrumented counts over the changed lines, with the uncovered ones listed. */
export function measure(changed, hits) {
  let covered = 0;
  let total = 0;
  const uncovered = [];
  for (const [file, lines] of Object.entries(changed)) {
    for (const n of lines) {
      const count = hits[file]?.get(n);
      if (count === undefined) continue; // not executable (types, comments, blank)
      total += 1;
      if (count > 0) covered += 1;
      else uncovered.push(`${file}:${String(n)}`);
    }
  }
  return { covered, total, ratio: total === 0 ? 1 : covered / total, uncovered };
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function lcovFiles(root) {
  const found = [];
  for (const area of ['apps', 'packages']) {
    for (const pkg of readdirSync(join(root, area))) {
      const entries = safeReaddir(join(root, area, pkg));
      for (const entry of entries.filter((name) => name.startsWith('coverage'))) {
        const dir = join(root, area, pkg, entry);
        try {
          found.push({
            text: readFileSync(join(dir, 'lcov.info'), 'utf8'),
            dir: join(root, area, pkg),
          });
        } catch {
          // no lcov in this folder
        }
      }
    }
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const base = process.argv[2] ?? 'origin/main';
  const root = process.cwd();
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- CI and developer git
  const diff = execFileSync('git', ['diff', '-U0', `${base}...HEAD`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const result = measure(changedLines(diff), parseLcov(lcovFiles(root), root));
  const pct = (result.ratio * 100).toFixed(1);
  process.stdout.write(
    `Changed-line coverage: ${pct}% (${String(result.covered)}/${String(result.total)})\n`,
  );
  if (result.ratio < THRESHOLD) {
    process.stderr.write(
      `Below ${String(THRESHOLD * 100)}%. Uncovered changed lines:\n${result.uncovered.join('\n')}\n`,
    );
    process.exitCode = 1;
  }
}
