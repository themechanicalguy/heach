import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { percentile, pick, run, summarise } from './load-test.mjs';

describe('load test (Step 10, PF)', () => {
  it('percentiles come from the sorted latencies', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(sorted, 50), 50);
    assert.equal(percentile(sorted, 95), 95);
    assert.equal(percentile(sorted, 99), 99);
    assert.equal(percentile([], 95), 0);
  });

  it('the mix is picked by weight', () => {
    const mix = [
      { weight: 3, path: '/a' },
      { weight: 1, path: '/b' },
    ];
    assert.equal(pick(mix, 0), '/a');
    assert.equal(pick(mix, 0.74), '/a');
    assert.equal(pick(mix, 0.76), '/b');
  });

  it('errors count in the error rate and the throughput', () => {
    assert.deepEqual(summarise([10, 20, 30], 1, 2), {
      requests: 4,
      perSecond: 2,
      p50: 20,
      p95: 30,
      p99: 30,
      errorRate: 25,
    });
  });

  it('runs against a server and counts failures', async () => {
    let n = 0;
    const server = createServer((_request, response) => {
      n += 1;
      response.writeHead(n % 5 === 0 ? 500 : 200).end('ok');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const result = await run({
      base: `http://127.0.0.1:${String(port)}`,
      concurrency: 3,
      seconds: 0.5,
      mix: [{ weight: 1, path: '/' }],
    });
    server.close();
    assert.ok(result.requests > 0);
    assert.ok(result.errorRate > 0 && result.errorRate < 50);
  });
});
