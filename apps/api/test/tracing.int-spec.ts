import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

const PORT = '3097';
const JAEGER = `http://localhost:${process.env.JAEGER_UI_PORT ?? '16686'}`;
const API = `http://localhost:${PORT}`;

interface Span {
  name: string;
  attributes?: { key: string; value: { stringValue?: string } }[];
}

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function spansFor(correlationId: string): Promise<Span[] | undefined> {
  const day = 24 * 60 * 60 * 1000;
  const query = new URLSearchParams({
    'query.service_name': 'heach-api',
    'query.start_time_min': new Date(Date.now() - day).toISOString(),
    'query.start_time_max': new Date(Date.now() + day).toISOString(),
    'query.attributes': JSON.stringify({ 'heach.correlation_id': correlationId }),
  });
  const response = await fetch(`${JAEGER}/api/v3/traces?${query.toString()}`);
  if (!response.ok) return undefined;
  const body = (await response.json()) as {
    result?: { resourceSpans: { scopeSpans: { spans: Span[] }[] }[] };
  };
  const spans =
    body.result?.resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans)) ?? [];
  return spans.length > 0 ? spans : undefined;
}

describe('Tracing (LM-01.1, LM-05.1)', () => {
  let api: ChildProcess;
  let output = '';

  beforeAll(async () => {
    api = spawn(process.execPath, ['--import', './dist/telemetry.js', 'dist/main.js'], {
      env: {
        ...process.env,
        API_PORT: PORT,
        APP_ENV: 'test',
        FEATURE_FLAGS: 'sample-patient-note',
      },
    });
    api.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    await waitFor(async () => ((await fetch(`${API}/healthz`)).ok ? true : undefined));
  }, 40_000);

  afterAll(async () => {
    api.kill('SIGTERM');
    await once(api, 'exit');
  });

  it('LM-01.1 one correlation ID links the request, its database queries and its log lines', async () => {
    const correlationId = `lm01-${String(Date.now())}`;
    const signIn = await fetch(`${API}/v1/auth/test-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: '00000000-0000-4000-8000-000000000001' }),
    });
    const { accessToken } = (await signIn.json()) as { accessToken: string };
    const response = await fetch(`${API}/v1/sample/notes`, {
      headers: { authorization: `Bearer ${accessToken}`, 'x-correlation-id': correlationId },
    });
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);

    const spans = await waitFor(() => spansFor(correlationId));
    expect(spans.some((s) => s.name.startsWith('pg.query'))).toBe(true);
    const logLine = output.split('\n').find((line) => line.includes(correlationId));
    expect(logLine).toMatch(/"traceId":"[0-9a-f]{32}"/);
  }, 45_000); // the SDK exports spans in batches every few seconds
});
