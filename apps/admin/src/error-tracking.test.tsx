import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Env {
  state: { status: string; me?: { role: string } };
  init: (options: object) => void;
  setTag: (key: string, value: string) => void;
  client: object | undefined;
}

const env = vi.hoisted((): Env => ({
  state: { status: 'checking' },
  init: vi.fn(),
  setTag: vi.fn(),
  client: undefined,
}));

vi.mock('./session', () => ({ useSession: () => ({ state: env.state }) }));
vi.mock('@sentry/browser', () => ({
  getClient: () => env.client,
  init: (options: object) => {
    env.init(options);
    env.client = {};
  },
  setTag: env.setTag,
}));

/** The component as built with these settings: Vite reads them when the module loads. */
async function built(dsn?: string) {
  vi.resetModules();
  vi.stubEnv('VITE_GLITCHTIP_DSN', dsn ?? '');
  vi.stubEnv('VITE_BUILD_VERSION', 'synthetic-release');
  return (await import('./ErrorTracking')).ErrorTracking;
}

beforeEach(() => {
  vi.mocked(env.init).mockReset();
  vi.mocked(env.setTag).mockReset();
  env.client = undefined;
  env.state = { status: 'checking' };
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Admin console error tracking (LM-03)', () => {
  it('sends nothing when no DSN is built in', async () => {
    const ErrorTracking = await built();
    render(<ErrorTracking />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(env.init).not.toHaveBeenCalled();
  });

  it('starts once with the release and no personal data, and tags the sub-role', async () => {
    const ErrorTracking = await built('https://key@glitchtip.example/1');
    env.state = { status: 'signed-in', me: { role: 'verifier' } };
    const { rerender } = render(<ErrorTracking />);
    await vi.waitFor(() => {
      expect(env.setTag).toHaveBeenCalledWith('role', 'verifier');
    });
    expect(env.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@glitchtip.example/1',
        release: 'synthetic-release',
        dataCollection: expect.objectContaining({ userInfo: false, cookies: false }) as unknown,
      }),
    );
    env.state = { status: 'signed-out' };
    rerender(<ErrorTracking />);
    await vi.waitFor(() => {
      expect(env.setTag).toHaveBeenLastCalledWith('role', 'signed-out');
    });
    expect(env.init).toHaveBeenCalledTimes(1);
  });
});
