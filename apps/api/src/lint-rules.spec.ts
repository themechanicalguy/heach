import { ESLint } from 'eslint';

// Type-aware linting is slow on a busy CI runner; one lint run, generous timeout.
const TIMEOUT_MS = 120_000;

const FIXTURE = `import { FakeSmsSender } from './adapters/fakes.js';
console.log(FakeSmsSender);
console.error('x');
`;

describe('Lint rules for app code', () => {
  it(
    'LM-02.2 TS-06.1 fails on console.* and on importing adapter implementations in app code',
    async () => {
      const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
      const [result] = await eslint.lintText(FIXTURE, { filePath: 'src/main.ts' });
      const errors = (result?.messages ?? []).filter((m) => m.severity === 2);
      const linesFor = (rule: string) => errors.filter((m) => m.ruleId === rule).map((m) => m.line);
      expect(linesFor('no-console')).toEqual([2, 3]); // LM-02.2
      expect(linesFor('no-restricted-imports')).toEqual([1]); // TS-06.1
    },
    TIMEOUT_MS,
  );
});
