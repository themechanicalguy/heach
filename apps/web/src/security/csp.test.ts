import { contentSecurityPolicy } from './csp';

describe('contentSecurityPolicy', () => {
  it('SO-05.1 allows no inline script without the nonce and no framing', () => {
    const csp = contentSecurityPolicy('abc', false);
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('LM-03.1 lets error reports reach only the configured GlitchTip origin', () => {
    const connect = (dsn?: string) =>
      contentSecurityPolicy('abc', false, dsn)
        .split('; ')
        .find((d) => d.startsWith('connect-src'));
    expect(connect()).toBe("connect-src 'self'");
    expect(connect('https://key@errors.example.test/3')).toBe(
      "connect-src 'self' https://errors.example.test",
    );
  });
});
