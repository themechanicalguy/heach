import { Writable } from 'node:stream';
import { createLogger } from './index.js';

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
