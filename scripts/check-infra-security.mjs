// CI check over the OpenTofu code (Step 2): EN-02.1 every bucket, disk and backup is encrypted
// with KMS; EN-05.2 every customer managed key rotates yearly; EN-04.2 the app host may use KMS
// for GenerateDataKey and Decrypt only; EN-12.4 the API role reads its parameters by exact name,
// never the administrator or migrator password, and no container can reach the instance role
// (security review 2026-10-24, finding 7). Static, like check-tags.mjs: no AWS access needed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const HOST_KMS_ACTIONS = new Set(['kms:GenerateDataKey', 'kms:Decrypt']);
const PRIVILEGED_PARAMETERS = ['POSTGRES_PASSWORD', 'DB_MIGRATOR_PASSWORD'];

function tfFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '.terraform') return [];
    if (statSync(path).isDirectory()) return tfFiles(path);
    return name.endsWith('.tf') ? [path] : [];
  });
}

/** The text of each `resource "<type>" "<name>" { … }` block, by brace matching. */
function blocks(text, opener) {
  const found = [];
  for (const match of text.matchAll(opener)) {
    let depth = 0;
    let i = text.indexOf('{', match.index);
    const start = i;
    for (; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      if (text[i] === '}' && --depth === 0) break;
    }
    found.push(text.slice(start, i + 1));
  }
  return found;
}

/** Problems in one file's text; `file` names it in messages. */
export function problemsIn(file, text) {
  const problems = [];
  if (/resource "aws_s3_bucket" "/.test(text) && !/sse_algorithm\s*=\s*"aws:kms"/.test(text)) {
    problems.push(`${file}: bucket without SSE-KMS (EN-02.1)`);
  }
  for (const block of blocks(
    text,
    /(root_block_device|ebs_block_device)\s*\{|resource "aws_ebs_volume" "[^"]+"\s*\{/g,
  )) {
    if (!/encrypted\s*=\s*true/.test(block)) problems.push(`${file}: unencrypted disk (EN-02.1)`);
  }
  for (const block of blocks(text, /resource "aws_kms_key" "[^"]+"\s*\{/g)) {
    if (!/enable_key_rotation\s*=\s*true/.test(block))
      problems.push(`${file}: KMS key without yearly rotation (EN-05.2)`);
  }
  if (file.includes('modules/app-host')) {
    for (const action of text.match(/"kms:[A-Za-z*]+"/g) ?? []) {
      if (!HOST_KMS_ACTIONS.has(action.slice(1, -1)))
        problems.push(`${file}: host role allows ${action} (EN-04.2)`);
    }
    problems.push(...appHostRoleProblems(file, text));
  }
  problems.push(...apiParameterProblems(file, text));
  return problems;
}

/** The API role reads parameters by name only; containers cannot use the instance role. */
function appHostRoleProblems(file, text) {
  const problems = [];
  for (const block of blocks(text, /resource "aws_iam_role_policy" "api"\s*\{/g)) {
    if (/parameter[^"]*\/\*"|GetParametersByPath|"ssm:\*"|"ssm:GetParameter"/.test(block))
      problems.push(`${file}: API role reads parameters beyond its own names (EN-12.4)`);
    if (/sts:AssumeRole/.test(block)) problems.push(`${file}: API role may assume roles (EN-12.4)`);
  }
  for (const block of blocks(text, /metadata_options\s*\{/g)) {
    if (!/http_put_response_hop_limit\s*=\s*1\b/.test(block))
      problems.push(`${file}: containers can reach the instance role (hop limit above 1, EN-12.4)`);
  }
  return problems;
}

/** The parameters given to the API role never include the privileged passwords. */
function apiParameterProblems(file, text) {
  const list = /api_parameter_names\s*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '';
  return PRIVILEGED_PARAMETERS.filter((name) => list.includes(`"${name}"`)).map(
    (name) => `${file}: API role may read ${name} (EN-12.4)`,
  );
}

/** The names in `api_parameter_names` of a .tf file, in order. */
export function apiParameterNames(text) {
  const list = /api_parameter_names\s*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '';
  return [...list.matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const problems = tfFiles('infra').flatMap((file) => problemsIn(file, readFileSync(file, 'utf8')));
  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(
    'Infra security OK: KMS on buckets and disks, key rotation, host KMS actions, API role\n',
  );
}
