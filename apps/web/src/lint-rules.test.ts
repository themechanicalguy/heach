// @vitest-environment node
import { ESLint } from 'eslint';

// Type-aware linting is slow on a busy CI runner; one lint run, generous timeout.
const TIMEOUT_MS = 120_000;

const FIXTURE = `console.log('x');
export default function P() {
  return (
    <div>
      <p>Hello</p>
      <img alt="Doctor" src="/x.png" />
    </div>
  );
}
`;

describe('Lint rules for web code', () => {
  it(
    'I18N-02.1 LM-02.2 hard-coded JSX text, text props and console.* fail lint',
    async () => {
      const eslint = new ESLint({ cwd: process.cwd() });
      const [result] = await eslint.lintText(FIXTURE, { filePath: 'src/app/[locale]/page.tsx' });
      const errors = (result?.messages ?? [])
        .filter((m) => m.severity === 2)
        .map((m) => `${String(m.line)}:${m.ruleId ?? ''}`);
      expect(errors).toEqual(
        expect.arrayContaining([
          '1:no-console',
          '5:no-restricted-syntax',
          '6:no-restricted-syntax',
        ]),
      );
    },
    TIMEOUT_MS,
  );
});
