// Uploads the web app's browser source maps to GlitchTip for one release, then deletes them so
// they are never served (LM-03.1). Uses GlitchTip's Sentry-compatible chunk upload and artifact
// bundle API, with no extra dependency (@sentry/cli is FSL-licensed, outside D4).
//
// Usage: build with SOURCE_MAPS=upload, then
//   GLITCHTIP_URL=… GLITCHTIP_ORG=… GLITCHTIP_PROJECT=… GLITCHTIP_AUTH_TOKEN=… \
//   node scripts/upload-source-maps.mjs <release> [apps/web/.next/static]
import { Blob, Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { crc32, gzipSync } from 'node:zlib';

const URL_PREFIX = '~/_next/static/';

const MAP_COMMENT = /\/\/# sourceMappingURL=([\w.-]+\.map)\s*$/;

/**
 * Each `.js` file under `dir` with the map its `sourceMappingURL` comment names (bundlers name
 * maps independently of scripts), as `{ script, map }` paths relative to `dir`.
 */
export function findMappedScripts(dir) {
  const files = new Set(readdirSync(dir, { recursive: true }).map(String));
  const pairs = [];
  for (const script of [...files].filter((file) => file.endsWith('.js')).sort()) {
    const name = MAP_COMMENT.exec(readFileSync(path.join(dir, script), 'utf8'))?.[1];
    const map = name && path.join(path.dirname(script), name);
    if (map && files.has(map)) pairs.push({ script, map });
  }
  return pairs;
}

/** Every source map under `dir` (scripts and styles), relative to `dir`. */
export function findMaps(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.map'));
}

const assetUrl = (file) => URL_PREFIX + file.split(path.sep).join('/');

/** The artifact bundle manifest: each script and its map, matched by release and file name. */
export function bundleManifest(pairs, { org, release }) {
  const files = {};
  for (const { script, map } of pairs) {
    files[`files/${script}`] = {
      url: assetUrl(script),
      type: 'minified_source',
      headers: { Sourcemap: path.basename(map) },
    };
    files[`files/${map}`] = { url: assetUrl(map), type: 'source_map', headers: {} };
  }
  return { org, release, files };
}

/** A minimal uncompressed (stored) zip archive; entries are `{ name, data }`. */
export function zipStored(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const header = zipHeader(nameBytes, data, offset);
    locals.push(header.local, nameBytes, data);
    centrals.push(header.central, nameBytes);
    offset += header.local.length + nameBytes.length + data.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

function zipHeader(nameBytes, data, offset) {
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(offset, 42);
  return { local, central };
}

function buildBundle(dir, pairs, options) {
  const manifest = bundleManifest(pairs, options);
  const entries = [{ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) }];
  for (const name of Object.keys(manifest.files)) {
    entries.push({ name, data: readFileSync(path.join(dir, name.slice('files/'.length))) });
  }
  return zipStored(entries);
}

async function glitchtip(env, apiPath, body) {
  const response = await globalThis.fetch(`${env.GLITCHTIP_URL}/api/0/${apiPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GLITCHTIP_AUTH_TOKEN}` },
    body,
  });
  if (!response.ok) throw new Error(`GlitchTip ${apiPath} answered ${response.status}`);
  return response.json();
}

async function upload(env, bundle, release) {
  // SHA-1 is the chunk protocol's content checksum, not a security control.
  // eslint-disable-next-line sonarjs/hashing
  const checksum = createHash('sha1').update(bundle).digest('hex');
  const form = new globalThis.FormData();
  form.append('file_gzip', new Blob([gzipSync(bundle)]), checksum);
  await glitchtip(env, `organizations/${env.GLITCHTIP_ORG}/chunk-upload/`, form);
  const assemble = JSON.stringify({
    checksum,
    chunks: [checksum],
    projects: [env.GLITCHTIP_PROJECT],
    version: release,
  });
  return glitchtip(env, `organizations/${env.GLITCHTIP_ORG}/artifactbundle/assemble/`, assemble);
}

async function main([release, dir = 'apps/web/.next/static']) {
  const env = process.env;
  const missing = ['GLITCHTIP_URL', 'GLITCHTIP_ORG', 'GLITCHTIP_PROJECT', 'GLITCHTIP_AUTH_TOKEN'];
  if (!release || missing.some((key) => !env[key])) {
    throw new Error(`Usage: ${missing.join('=… ')}=… upload-source-maps.mjs <release> [dir]`);
  }
  const pairs = findMappedScripts(dir);
  if (pairs.length === 0)
    throw new Error(`No source maps in ${dir}; build with SOURCE_MAPS=upload`);
  const result = await upload(
    env,
    buildBundle(dir, pairs, { org: env.GLITCHTIP_ORG, release }),
    release,
  );
  if (result.state !== 'created' && result.state !== 'ok')
    throw new Error(`Assemble: ${result.state}`);
  const maps = findMaps(dir);
  for (const map of maps) rmSync(path.join(dir, map));
  process.stdout.write(
    `Uploaded ${pairs.length} source maps for ${release}; deleted ${maps.length}.\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
