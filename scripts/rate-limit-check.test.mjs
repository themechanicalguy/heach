import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const script = new URL('./rate-limit-check.sh', import.meta.url).pathname;

/** A stand-in for the proxy and API: `answer(n)` gives the nth response as [status, body]. */
async function serve(answer) {
  let n = 0;
  const seen = [];
  const server = createServer((request, response) => {
    n += 1;
    seen.push({
      url: request.url,
      auth: request.headers.authorization,
      xff: request.headers['x-forwarded-for'],
    });
    const [status, body] = answer(n);
    response.writeHead(status).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, seen, close: () => server.close() };
}

async function check(answer) {
  const stub = await serve(answer);
  try {
    const result = await run('bash', [script, stub.base]).then(
      (ok) => ({ code: 0, out: ok.stdout, err: ok.stderr }),
      (failed) => ({ code: failed.code, out: failed.stdout, err: failed.stderr }),
    );
    return { ...result, seen: stub.seen };
  } finally {
    stub.close();
  }
}

const apiError = '{"statusCode":429,"error":"ThrottlerException"}';

describe('scripts/rate-limit-check.sh (SO-08.10)', () => {
  it('passes when the API refuses after its limit', async () => {
    const result = await check((n) => (n <= 120 ? [401, '{}'] : [429, apiError]));
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /api_429=30 early_429=0/);
  });

  it('sends a new token and a new forwarding header on every request', async () => {
    const result = await check(() => [401, '{}']);
    assert.equal(result.seen.length, 150);
    assert.equal(new Set(result.seen.map((s) => s.auth)).size, 150);
    assert.ok(new Set(result.seen.map((s) => s.xff)).size > 100);
    assert.ok(result.seen.every((s) => s.url === '/api/v1/auth/refresh'));
  });

  it('fails when nothing is ever refused (the bypass)', async () => {
    const result = await check(() => [401, '{}']);
    assert.notEqual(result.code, 0);
    assert.match(result.err, /no 429 from the API/);
  });

  it('fails when only the proxy refuses (empty 429 body)', async () => {
    const result = await check((n) => (n <= 120 ? [401, '{}'] : [429, '']));
    assert.notEqual(result.code, 0);
    assert.match(result.err, /no 429 from the API/);
  });

  it('fails when requests are refused too early', async () => {
    const result = await check((n) => (n <= 50 ? [401, '{}'] : [429, apiError]));
    assert.notEqual(result.code, 0);
    assert.match(result.err, /within the first 100/);
  });
});
