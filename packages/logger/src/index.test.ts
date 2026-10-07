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
