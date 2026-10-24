import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { apiParameterNames, problemsIn } from './check-infra-security.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('EN-02.1 fixture: a bucket without SSE-KMS and an unencrypted disk fail', () => {
  const tf = `resource "aws_s3_bucket" "b" { bucket = "x" }
resource "aws_instance" "i" {
  root_block_device {
    volume_size = 20
  }
}`;
  assert.deepEqual(problemsIn('infra/x.tf', tf), [
    'infra/x.tf: bucket without SSE-KMS (EN-02.1)',
    'infra/x.tf: unencrypted disk (EN-02.1)',
  ]);
});

test('EN-05.2 fixture: a key without rotation fails', () => {
  const tf = 'resource "aws_kms_key" "k" {\n  description = "x"\n}';
  assert.deepEqual(problemsIn('infra/k.tf', tf), [
    'infra/k.tf: KMS key without yearly rotation (EN-05.2)',
  ]);
});

test('EN-04.2 fixture: the host role may not encrypt or administer keys', () => {
  const tf = 'Action = ["kms:GenerateDataKey", "kms:Decrypt", "kms:Encrypt"]';
  assert.deepEqual(problemsIn('infra/modules/app-host/main.tf', tf), [
    'infra/modules/app-host/main.tf: host role allows "kms:Encrypt" (EN-04.2)',
  ]);
});

test('compliant code passes', () => {
  const tf = `resource "aws_kms_key" "k" {
  enable_key_rotation = true
}
resource "aws_s3_bucket" "b" {}
resource "x" "y" { sse_algorithm = "aws:kms" }`;
  assert.deepEqual(problemsIn('infra/ok.tf', tf), []);
});

test('EN-12.4 fixture: an API role reading the whole parameter path fails', () => {
  const tf = `resource "aws_iam_role_policy" "api" {
  policy = jsonencode({ Statement = [{
    Action   = ["ssm:GetParameters", "ssm:GetParametersByPath"]
    Resource = "arn:aws:ssm:r:1:parameter/heach/dev/*"
  }] })
}`;
  assert.deepEqual(problemsIn('infra/modules/app-host/main.tf', tf), [
    'infra/modules/app-host/main.tf: API role reads parameters beyond its own names (EN-12.4)',
  ]);
});

test('EN-12.4 fixture: a hop limit that lets containers reach the instance role fails', () => {
  const tf = 'metadata_options {\n  http_tokens = "required"\n  http_put_response_hop_limit = 2\n}';
  assert.deepEqual(problemsIn('infra/modules/app-host/main.tf', tf), [
    'infra/modules/app-host/main.tf: containers can reach the instance role (hop limit above 1, EN-12.4)',
  ]);
});

test('EN-12.4 fixture: giving the API role a privileged password fails', () => {
  const tf = 'api_parameter_names = ["DB_APP_PASSWORD", "DB_MIGRATOR_PASSWORD"]';
  assert.deepEqual(problemsIn('infra/envs/dev/main.tf', tf), [
    'infra/envs/dev/main.tf: API role may read DB_MIGRATOR_PASSWORD (EN-12.4)',
  ]);
});

test('EN-12.4 the committed API role and host pass the checks', () => {
  for (const file of ['infra/modules/app-host/main.tf', 'infra/envs/dev/main.tf']) {
    assert.deepEqual(problemsIn(file, read(file)), []);
  }
});

test('EN-12.4 the API role grants exactly the parameters the dev API asks for', () => {
  const granted = apiParameterNames(read('infra/envs/dev/main.tf'));
  const loader = read('apps/api/src/secrets/load-secrets.ts');
  const base = /API_SECRETS: readonly SecretName\[\] = \[([^\]]*)\]/.exec(loader)?.[1] ?? '';
  const devExtra = /appEnv === 'dev' \? \[\.\.\.API_SECRETS, ([^\]]*)\]/.exec(loader)?.[1] ?? '';
  const asked = [...`${base},${devExtra}`.matchAll(/'([A-Z0-9_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(granted, [
    'DB_APP_PASSWORD',
    'REDIS_PASSWORD',
    'BLIND_INDEX_KEY',
    'TEST_LOGIN_KEY',
  ]);
  assert.deepEqual(granted, asked);
});

test('EN-12.4 only the host role may assume the API role, and the API role nothing', () => {
  const module = read('infra/modules/app-host/main.tf');
  const role = /resource "aws_iam_role" "api" \{[\s\S]*?\n\}/.exec(module)?.[0] ?? '';
  assert.match(role, /Principal = \{ AWS = aws_iam_role\.host\.arn \}/);
  assert.match(role, /max_session_duration = 3600/);
});
