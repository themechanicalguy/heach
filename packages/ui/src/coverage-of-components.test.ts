// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import * as ui from './index.js';

const dir = new URL('.', import.meta.url);
const files = readdirSync(dir);

/** Component exports are functions named in PascalCase; tokens and helpers are not. */
const components = Object.entries(ui)
  .filter(([name, value]) => typeof value === 'function' && /^[A-Z]/.test(name))
  .map(([name]) => name);

describe('Every @heach/ui component is tested with axe', () => {
  it.each(components)('TS-02.1 %s has a test with an axe assertion', (name) => {
    const tests = files.filter((file) => file.endsWith('.test.tsx'));
    const covering = tests.filter((file) => {
      const text = readFileSync(new URL(file, dir), 'utf8');
      return new RegExp(`\\b${name}\\b`).test(text) && text.includes('expectNoAxeViolations');
    });
    expect(covering, `${name} needs a test that calls expectNoAxeViolations`).not.toEqual([]);
  });
});
