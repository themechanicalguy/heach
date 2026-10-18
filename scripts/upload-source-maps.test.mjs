import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { crc32 } from 'node:zlib';
import { bundleManifest, findMappedScripts, findMaps, zipStored } from './upload-source-maps.mjs';

test('LM-03.1: scripts are paired with the map their comment names', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maps-'));
  mkdirSync(path.join(dir, 'chunks'));
  const files = {
    'chunks/a.js': 'a()\n//# sourceMappingURL=x1.js.map',
    'chunks/x1.js.map': '{}',
    'chunks/b.js': 'b()',
    'chunks/c.js': 'c()\n//# sourceMappingURL=missing.js.map',
    'chunks/s.css.map': '{}',
  };
  for (const [file, body] of Object.entries(files)) writeFileSync(path.join(dir, file), body);
  assert.deepEqual(findMappedScripts(dir), [
    { script: path.join('chunks', 'a.js'), map: path.join('chunks', 'x1.js.map') },
  ]);
  assert.deepEqual(findMaps(dir).sort(), [
    path.join('chunks', 's.css.map'),
    path.join('chunks', 'x1.js.map'),
  ]);
});

test('LM-03.1: the manifest links each script to its map under the release', () => {
  const pairs = [{ script: 'chunks/a.js', map: 'chunks/x1.js.map' }];
  const manifest = bundleManifest(pairs, { org: 'heach', release: 'abc123' });
  assert.equal(manifest.release, 'abc123');
  assert.deepEqual(manifest.files['files/chunks/a.js'], {
    url: '~/_next/static/chunks/a.js',
    type: 'minified_source',
    headers: { Sourcemap: 'x1.js.map' },
  });
  assert.equal(manifest.files['files/chunks/x1.js.map'].type, 'source_map');
});

test('the zip writer produces a readable stored archive', () => {
  const zip = zipStored([
    { name: 'manifest.json', data: Buffer.from('{}') },
    { name: 'files/chunks/a.js', data: Buffer.from('ok') },
  ]);
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  assert.equal(zip.readUInt16LE(end + 10), 2);
  // Second local entry starts after the first header (30), name (13) and data (2).
  const second = 30 + 13 + 2;
  assert.equal(zip.readUInt32LE(second), 0x04034b50);
  const nameLength = zip.readUInt16LE(second + 26);
  assert.equal(zip.toString('utf8', second + 30, second + 30 + nameLength), 'files/chunks/a.js');
  assert.equal(zip.toString('utf8', second + 30 + nameLength, second + 32 + nameLength), 'ok');
  assert.equal(zip.readUInt32LE(second + 14), crc32(Buffer.from('ok')));
});
