import { Writable } from 'node:stream';
import { createLogger, maskValue } from './index.js';

function captureLines(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const lines = () =>
    chunks
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines };
}

describe('createLogger', () => {
  it('writes one JSON object per line with service, level and ISO time', () => {
    const { stream, lines } = captureLines();
    createLogger({ name: 'test', destination: stream }).info({ port: 3001 }, 'started');

    const [line] = lines();
    expect(line).toMatchObject({ service: 'test', level: 'info', port: 3001, msg: 'started' });
    expect(typeof line?.time).toBe('string');
  });

  it('redacts personal data at the top level and one level deep', () => {
    const { stream, lines } = captureLines();
    const logger = createLogger({ name: 'test', destination: stream, redact: ['patient.notes'] });
    logger.info({ mobile: '9876543210', patient: { name: 'Asha', notes: 'diabetic', id: 'p1' } });

    const [line] = lines();
    expect(line).toMatchObject({
      mobile: '[REDACTED]',
      patient: { name: '[REDACTED]', notes: '[REDACTED]', id: 'p1' },
    });
    expect(JSON.stringify(line)).not.toMatch(/9876543210|Asha|diabetic/);
  });
});

describe('LM-02.1 masking', () => {
  it('LM-02.1 masks names, mobile numbers and Restricted fields', () => {
    const { stream, lines } = captureLines();
    createLogger({ name: 'test', destination: stream }).warn(
      { name: 'Asha Das', body: 'ଜ୍ୱର ଅଛି', detail: 'call +91 9876543210 now' },
      'patient 9876543211 called',
    );
    const text = JSON.stringify(lines());
    expect(text).not.toMatch(/Asha|ଜ୍ୱର|9876543210|9876543211/);
    expect(text).toContain('[MOBILE]');
  });

  it('LM-02.1 keeps trace IDs, span IDs and UUIDs that contain ten digits, still masking mobiles', () => {
    const traceId = '1844611d9b9876543210bf4afd157080';
    const spanId = 'ab98765432101234';
    const uuid = 'e2a185e8-57c8-45ef-b956-2b9876543210';
    const masked = maskValue(`${traceId} ${spanId} ${uuid} call 9876543210, x9876543210`);
    expect(masked).toBe(`${traceId} ${spanId} ${uuid} call [MOBILE], x[MOBILE]`);
    expect(maskValue('id-9876543210abcdef12')).not.toContain('9876543210');
  });

  it('LM-01 adds context fields such as the correlation ID to every line', () => {
    const { stream, lines } = captureLines();
    createLogger({
      name: 'test',
      destination: stream,
      context: () => ({ correlationId: 'c-1' }),
    }).info('hi');
    expect(lines()[0]).toMatchObject({ correlationId: 'c-1', msg: 'hi' });
  });
});

describe('LM-02.3 to LM-02.7 through createLogger', () => {
  const MOBILE = '9876543210';

  function logged(write: (logger: ReturnType<typeof createLogger>) => void) {
    const { stream, lines } = captureLines();
    write(createLogger({ name: 'test', destination: stream }));
    return lines();
  }

  it('LM-02.3 redacts the audit probe req.query.phone', () => {
    const [line] = logged((logger) => {
      logger.info({ req: { query: { phone: MOBILE } } }, 'probe');
    });
    expect(line).toMatchObject({ req: { query: { phone: '[REDACTED]' } }, msg: 'probe' });
  });

  it('LM-02.4 masks the audit probe req.detail', () => {
    const [line] = logged((logger) => {
      logger.info({ req: { detail: `call ${MOBILE}` } });
    });
    expect(line).toMatchObject({ req: { detail: 'call [MOBILE]' } });
  });

  it('LM-02.5 masks an error under err and keeps its type', () => {
    const [line] = logged((logger) => {
      logger.error({ err: new TypeError(`to ${MOBILE}`) }, 'failed');
    });
    expect(line?.err).toMatchObject({ type: 'TypeError', message: 'to [MOBILE]' });
    expect(line?.msg).toBe('failed');
    expect(JSON.stringify(line)).not.toContain(MOBILE);
  });

  it('LM-02.5 masks logger.error(err) with no message', () => {
    const [line] = logged((logger) => {
      logger.error(new RangeError(`to ${MOBILE}`));
    });
    expect(line?.err).toMatchObject({ type: 'RangeError', message: 'to [MOBILE]' });
    expect(line?.msg).toBe('to [MOBILE]');
    expect(JSON.stringify(line)).not.toContain(MOBILE);
  });

  it('LM-02.5 keeps an explicit message after a leading error', () => {
    const [line] = logged((logger) => {
      logger.warn(new Error(`to ${MOBILE}`), 'sms %s', 'retry');
    });
    expect(line?.msg).toBe('sms retry');
    expect(JSON.stringify(line)).not.toContain(MOBILE);
  });

  it('LM-02.7 masks interpolation arguments, child bindings and context fields', () => {
    const { stream, lines } = captureLines();
    const logger = createLogger({
      name: 'test',
      destination: stream,
      context: () => ({ correlationId: 'c-1', request: { query: { phone: MOBILE } } }),
    });
    logger.info('sent %s and %j', `to ${MOBILE}`, { user: { contact: { mobile: MOBILE } } });
    const child = logger.child({
      visit: { patient: { name: 'Asha' } },
      detail: { text: `call ${MOBILE}` },
    });
    child.info({ step: 1 }, 'child');
    child.child({ who: { contact: { phone: MOBILE } }, scope: 'grandchild' }).info('grandchild');

    const text = JSON.stringify(lines());
    expect(text).not.toMatch(/9876543210|Asha/);
    expect(lines()[0]).toMatchObject({
      correlationId: 'c-1',
      request: { query: { phone: '[REDACTED]' } },
    });
    expect(lines()[2]).toMatchObject({
      scope: 'grandchild',
      who: { contact: { phone: '[REDACTED]' } },
    });
  });

  it('LM-02.8 writes existing call-site lines as before', () => {
    const [line] = logged((logger) => {
      logger.info({ scope: 'jobs', runId: 'r-1', domain: 'health', targetVersion: 3 }, 'done');
    });
    expect(line).toMatchObject({ scope: 'jobs', runId: 'r-1', domain: 'health', targetVersion: 3 });
  });
});
