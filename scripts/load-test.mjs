#!/usr/bin/env node
// Load and soak test for the public read paths (Step 10 "Harden" 2, PF): a fixed number of
// concurrent clients repeat a weighted mix of requests for a set time, then print throughput,
// latency percentiles and the error rate. Plain Node, no dependency. Synthetic traffic only.
//
//   node scripts/load-test.mjs --base http://localhost:3001 --concurrency 20 --seconds 60
//
// Against a shared environment it needs the owner's approval first (CLAUDE.md: infrastructure).
import { randomInt } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { parseArgs } from 'node:util';

/** The request mix: what an anonymous patient browsing for care does. */
export const MIX = [
  { weight: 4, path: '/v1/search?service=nursing&pin=751001&locale=en' },
  { weight: 3, path: '/v1/catalogue?service=nursing&locale=en' },
  { weight: 2, path: '/v1/plans?locale=en' },
  { weight: 1, path: '/healthz' },
];

/** The value at percentile p (0 to 100) of sorted numbers. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/** Picks a path by weight with a number in [0, 1). */
export function pick(mix, random) {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  let point = random * total;
  for (const entry of mix) {
    point -= entry.weight;
    if (point < 0) return entry.path;
  }
  return mix.at(-1).path;
}

/** Summary of one run: requests per second, latency percentiles in ms, error share. */
export function summarise(latencies, errors, seconds) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.length + errors;
  return {
    requests: total,
    perSecond: Math.round((total / seconds) * 10) / 10,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    errorRate: total === 0 ? 0 : Math.round((errors / total) * 10_000) / 100,
  };
}

export async function run({ base, concurrency, seconds, mix = MIX }) {
  const until = Date.now() + seconds * 1000;
  const latencies = [];
  let errors = 0;
  const client = async () => {
    while (Date.now() < until) {
      const started = performance.now();
      try {
        const response = await globalThis.fetch(
          `${base}${pick(mix, randomInt(0, 1_000_000) / 1_000_000)}`,
        );
        await response.arrayBuffer();
        if (response.ok) latencies.push(performance.now() - started);
        else errors += 1;
      } catch {
        errors += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, client));
  return summarise(latencies, errors, seconds);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'http://localhost:3001' },
      concurrency: { type: 'string', default: '10' },
      seconds: { type: 'string', default: '30' },
    },
  });
  const result = await run({
    base: values.base,
    concurrency: Number(values.concurrency),
    seconds: Number(values.seconds),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
