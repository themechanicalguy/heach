import { ESLint } from 'eslint';

// Type-aware linting is slow on a busy CI runner; one lint run, generous timeout.
const TIMEOUT_MS = 120_000;

describe('Lint rules for app code', () => {
  it(
    'LM-02.2 fails on console.* in app code',
    async () => {
      const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
      const [result] = await eslint.lintText("console.log('patient');\nconsole.error('x');\n", {
        filePath: 'src/main.ts',
      });
      const consoleErrors = result?.messages.filter(
        (m) => m.ruleId === 'no-console' && m.severity === 2,
      );
      expect(consoleErrors?.map((m) => m.line)).toEqual([1, 2]);
    },
    TIMEOUT_MS,
  );
});
