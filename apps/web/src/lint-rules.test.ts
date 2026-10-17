// @vitest-environment node
import { ESLint } from 'eslint';

async function lint(code: string): Promise<{ rule: string | null; severity: number }[]> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath: 'src/app/[locale]/page.tsx' });
  return result?.messages.map((m) => ({ rule: m.ruleId, severity: m.severity })) ?? [];
}

describe('Lint rules for web code', () => {
  it('I18N-02.1 a hard-coded string in JSX or a component prop fails lint', async () => {
    const text = await lint('export default function P() {\n  return <p>Hello</p>;\n}\n');
    const prop = await lint(
      'export default function P() {\n  return <img alt="Doctor" src="/x.png" />;\n}\n',
    );
    for (const messages of [text, prop]) {
      expect(messages).toContainEqual({ rule: 'no-restricted-syntax', severity: 2 });
    }
  }, 60_000);

  it('LM-02.2 console.* fails lint in app code', async () => {
    expect(await lint("console.log('x');\nexport {};\n")).toContainEqual({
      rule: 'no-console',
      severity: 2,
    });
  }, 60_000);
});
