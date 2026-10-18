import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dashboard = JSON.parse(
  readFileSync('deploy/observability/grafana/dashboards/heach-api.json', 'utf8'),
);
const expressions = dashboard.panels.flatMap((panel) => panel.targets.map((t) => t.expr));

test('LM-05.1: one dashboard shows request rate, error rate and p50, p95, p99', () => {
  assert.ok(expressions.every((expr) => expr.includes('http_server_request_duration_seconds')));
  assert.ok(expressions.some((expr) => /^sum\(rate\(.*_count\{job="heach-api"\}/.test(expr)));
  assert.ok(expressions.some((expr) => expr.includes('http_response_status_code=~"5.."')));
  for (const quantile of ['0.5', '0.95', '0.99']) {
    assert.ok(expressions.some((expr) => expr.startsWith(`histogram_quantile(${quantile},`)));
  }
});
