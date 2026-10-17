// CI check (playbook part B4): every OpenTofu stack must tag all its resources with the
// application, environment and owner tags. Tags come from the naming module through the AWS
// provider's default_tags, so the check fails when a stack bypasses that or the module drops a tag.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const INFRA = 'infra';
const REQUIRED_TAGS = ['Project', 'Environment', 'Owner'];

function stackDirs() {
  const envs = readdirSync(join(INFRA, 'envs')).map((name) => join(INFRA, 'envs', name));
  const top = readdirSync(INFRA)
    .map((name) => join(INFRA, name))
    .filter((dir) => !dir.endsWith('envs') && !dir.endsWith('modules'));
  return [...top, ...envs].filter((dir) => statSync(dir).isDirectory());
}

function hclFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.tf'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

function providerProblems(dir) {
  const providers = hclFiles(dir)
    .split(/^provider "aws" \{/m)
    .slice(1);
  if (providers.length === 0) return [];
  return providers
    .filter(
      (block) =>
        !/default_tags\s*\{[^}]*tags\s*=[^\n]*module\.naming\.tags/s.test(block.split(/^}/m)[0]),
    )
    .map(() => `${dir}: provider "aws" must set default_tags from module.naming.tags`);
}

function namingProblems() {
  const naming = hclFiles(join(INFRA, 'modules', 'naming'));
  return REQUIRED_TAGS.filter((tag) => !new RegExp(`^\\s+${tag}\\s+=`, 'm').test(naming)).map(
    (tag) => `modules/naming: tags output is missing ${tag}`,
  );
}

const problems = [...namingProblems(), ...stackDirs().flatMap(providerProblems)];
if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Tags OK: ${REQUIRED_TAGS.join(', ')} on every stack\n`);
