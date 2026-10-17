// @vitest-environment node
import { readFileSync } from 'node:fs';
import { breakpoints, deviceClass, media } from './tokens.js';

const css = readFileSync(new URL('../ui.css', import.meta.url), 'utf8');

describe('Layout tokens', () => {
  it('UX-02.1 define 360 to 599, 600 to 1023 and 1024 px and up', () => {
    expect(breakpoints).toEqual({
      mobile: { min: 360, max: 599 },
      tablet: { min: 600, max: 1023 },
      desktop: { min: 1024 },
    });
    expect([359, 360, 599, 600, 1023, 1024].map(deviceClass)).toEqual([
      'mobile',
      'mobile',
      'mobile',
      'tablet',
      'tablet',
      'desktop',
    ]);
  });

  it('UX-02.1 ui.css uses the same breakpoints', () => {
    expect(css).toContain(`@media ${media.tablet}`);
    expect(css).toContain(`@media ${media.desktop}`);
  });
});
