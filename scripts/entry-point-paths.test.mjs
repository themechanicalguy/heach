import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';

test('import.meta.main is true for a script in a folder with a space', () => {
  const dir = mkdtempSync(join(tmpdir(), 'heach path '));
  try {
    const script = join(dir, 'entry.mjs');
    writeFileSync(script, "if (import.meta.main) console.log('ran');\n");
    assert.equal(execFileSync(process.execPath, [script], { encoding: 'utf8' }).trim(), 'ran');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('no script compares import.meta.url with a hand-built file URL', () => {
  // Those comparisons never match on a path that URL encoding changes, and exit silently.
  const pattern = ['import\\.meta\\.url ===', ' `file:'].join('');
  const search = spawnSync(
    '/usr/bin/git',
    ['grep', '-lE', pattern, '--', 'apps', 'packages', 'scripts'],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(search.stdout.trim(), '');
});
