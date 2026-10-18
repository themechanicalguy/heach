import assert from 'node:assert/strict';
import { test } from 'node:test';
import { problemsIn } from './check-infra-security.mjs';

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
