import { readFileSync } from 'node:fs';
import type { HealthStatus, paths } from './index.js';

describe('generated API types', () => {
  it('describe the health response', () => {
    expectTypeOf<HealthStatus>().toEqualTypeOf<{ status: 'ok'; version: string }>();
    expectTypeOf<paths>().toHaveProperty('/healthz');
  });

  it('come from an OpenAPI document that has the health routes', () => {
    const document = JSON.parse(readFileSync('openapi.json', 'utf8')) as { paths: object };
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining(['/healthz', '/readyz']));
  });
});
