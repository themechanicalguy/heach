import { ESLint } from 'eslint';

/** Lints a snippet as if it were app code, with this package's real ESLint config. */
async function lint(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
  const [result] = await eslint.lintText(code, { filePath: 'src/main.ts' });
  return result?.messages.map((message) => message.ruleId ?? 'fatal') ?? [];
}

describe('Lint rules for app code', () => {
  it('LM-02.2 fails on console.* in app code', async () => {
    expect(await lint("console.log('patient');\n")).toContain('no-console');
    expect(await lint("console.error('x');\n")).toContain('no-console');
  }, 30_000);
});
