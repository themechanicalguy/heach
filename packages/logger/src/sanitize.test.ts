import { isPersonalKey, sanitizeLogValue } from './sanitize.js';

// Synthetic values only (SO-07): numbers in the 98765 4xxxx range, invented names.
const MOBILE = '9876543210';
const NAME = 'Asha Das';

const asText = (value: unknown) => JSON.stringify(value);

describe('LM-02.3 personal keys at any depth', () => {
  it('LM-02.3 redacts personal keys at depth 2 and 3, in arrays and in any case', () => {
    const value = {
      req: { query: { phone: MOBILE }, headers: { Authorization: 'Bearer abc' } },
      patient: { contact: { mobileNumber: MOBILE, full_name: NAME } },
      people: [{ 'given-name': NAME }, { PHONE: 7 }],
      session: { refresh_token: 'r', accessToken: 'a', 'auth.cookie': 'c' },
    };
    expect(sanitizeLogValue(value)).toEqual({
      req: { query: { phone: '[REDACTED]' }, headers: { Authorization: '[REDACTED]' } },
      patient: { contact: { mobileNumber: '[REDACTED]', full_name: '[REDACTED]' } },
      people: [{ 'given-name': '[REDACTED]' }, { PHONE: '[REDACTED]' }],
      session: {
        refresh_token: '[REDACTED]',
        accessToken: '[REDACTED]',
        'auth.cookie': '[REDACTED]',
      },
    });
  });

  it('LM-02.3 redacts a personal key whatever its value type', () => {
    expect(sanitizeLogValue({ a: { name: { first: NAME } }, b: { notes: ['x'] } })).toEqual({
      a: { name: '[REDACTED]' },
      b: { notes: '[REDACTED]' },
    });
  });

  it('LM-02.3 matches keys by word, not by substring', () => {
    expect(isPersonalKey('phoneNumber')).toBe(true);
    expect(isPersonalKey('patient_name')).toBe(true);
    expect(isPersonalKey('X-Auth-Token')).toBe(true);
    expect(isPersonalKey('phone2')).toBe(true);
    expect(isPersonalKey('runId')).toBe(false);
    expect(isPersonalKey('scope')).toBe(false);
    expect(isPersonalKey('durationMs')).toBe(false);
    expect(isPersonalKey('nameserver')).toBe(false);
  });
});

describe('LM-02.4 mobile numbers in values at any depth', () => {
  it('LM-02.4 masks mobile numbers in nested strings, array elements and numbers', () => {
    const value = {
      req: { detail: `call ${MOBILE} now`, list: [`+91 ${MOBILE}`, 'ok', 919876543211] },
      deep: { a: { b: { c: 9876543212 } } },
    };
    expect(sanitizeLogValue(value)).toEqual({
      req: { detail: 'call [MOBILE] now', list: ['[MOBILE]', 'ok', '[MOBILE]'] },
      deep: { a: { b: { c: '[MOBILE]' } } },
    });
  });

  it('LM-02.4 masks a top-level string and keeps other numbers', () => {
    expect(sanitizeLogValue(`sent to ${MOBILE}`)).toBe('sent to [MOBILE]');
    expect(sanitizeLogValue({ count: 12, durationMs: 3.25, epochMs: 1_761_650_000_000 })).toEqual({
      count: 12,
      durationMs: 3.25,
      epochMs: 1_761_650_000_000,
    });
  });
});

describe('LM-02.5 errors', () => {
  class SmsError extends Error {
    constructor(
      message: string,
      readonly mobile: string,
      readonly details: { reason: string },
    ) {
      super(message);
      this.name = 'SmsError';
    }
  }

  it('LM-02.5 masks error message and stack and keeps the type', () => {
    const error = new SmsError(`send to ${MOBILE} failed`, MOBILE, { reason: `bad ${MOBILE}` });
    const result = sanitizeLogValue({ err: error }) as { err: Record<string, unknown> };
    expect(result.err.type).toBe('SmsError');
    expect(result.err.message).toBe('send to [MOBILE] failed');
    expect(result.err.stack).toEqual(expect.stringContaining('send to [MOBILE] failed'));
    expect(result.err.mobile).toBe('[REDACTED]');
    expect(result.err.details).toEqual({ reason: 'bad [MOBILE]' });
    expect(asText(result)).not.toContain(MOBILE);
  });

  it('LM-02.5 masks a nested cause', () => {
    const error = new Error('outer', { cause: new Error(`inner ${MOBILE}`) });
    expect(asText(sanitizeLogValue({ err: error }))).not.toContain(MOBILE);
  });
});

describe('LM-02.6 values that cannot be inspected', () => {
  it('LM-02.6 writes placeholders for depth, cycles, binary and unreadable fields', () => {
    let deep: Record<string, unknown> = { leaf: MOBILE };
    for (let level = 0; level < 10; level += 1) deep = { next: deep };
    expect(asText(sanitizeLogValue(deep))).toContain('[DEPTH]');
    expect(asText(sanitizeLogValue(deep))).not.toContain(MOBILE);

    const circular: Record<string, unknown> = { id: 'c1' };
    circular.self = circular;
    expect(sanitizeLogValue(circular)).toEqual({ id: 'c1', self: '[CIRCULAR]' });

    expect(
      sanitizeLogValue({
        buffer: Buffer.from(MOBILE),
        array: new ArrayBuffer(4),
        view: new Uint8Array(2),
      }),
    ).toEqual({ buffer: '[BINARY]', array: '[BINARY]', view: '[BINARY]' });

    const unreadable = Object.defineProperty({ ok: 1 }, 'broken', {
      enumerable: true,
      get() {
        throw new Error(`no ${MOBILE}`);
      },
    });
    expect(sanitizeLogValue(unreadable)).toEqual({ ok: 1, broken: '[UNREADABLE]' });
  });

  it('LM-02.6 writes a repeated reference that is not circular in both places', () => {
    const shared = { id: 's1' };
    expect(sanitizeLogValue({ a: shared, b: shared })).toEqual({
      a: { id: 's1' },
      b: { id: 's1' },
    });
  });
});

describe('LM-02.8 input unchanged, IDs kept', () => {
  it('LM-02.8 leaves the input unchanged and keeps IDs and counts', () => {
    const input = {
      correlationId: 'c-1',
      traceId: '1844611d9b9876543210bf4afd157080',
      spanId: 'ab98765432101234',
      runId: 'e2a185e8-57c8-45ef-b956-2b9876543210',
      counts: { rows: 42, keys: [1, 2] },
      when: new Date('2026-10-28T00:00:00Z'),
      phone: MOBILE,
    };
    const copy = structuredClone(input);
    const result = sanitizeLogValue(input) as Record<string, unknown>;
    expect(input).toEqual(copy);
    expect(result).toMatchObject({
      correlationId: 'c-1',
      traceId: input.traceId,
      spanId: input.spanId,
      runId: input.runId,
      counts: { rows: 42, keys: [1, 2] },
      when: input.when,
      phone: '[REDACTED]',
    });
  });
});

describe('SC-002 corpus', () => {
  const nested = (value: unknown) => ({ a: { b: value } });
  const corpus: [string, unknown][] = [
    ['phone key at depth 0', { phone: MOBILE }],
    ['phone key at depth 3', { a: { b: { c: { phone: MOBILE } } } }],
    ['camelCase key', nested({ mobileNo: MOBILE })],
    ['snake_case key', nested({ patient_name: NAME })],
    ['kebab-case key', nested({ 'x-phone': MOBILE })],
    ['upper-case key', nested({ NAME })],
    ['number in a nested string', nested(`call ${MOBILE}`)],
    ['number with +91', nested(`+91-${MOBILE}`)],
    ['number with 91 prefix', nested(`91${MOBILE}`)],
    ['number as a number', nested(Number(MOBILE))],
    ['number in an array', nested(['a', MOBILE])],
    ['number in an array of objects', nested([{ note: 'x' }, { text: MOBILE }])],
    ['error message', { err: new Error(`to ${MOBILE}`) }],
    ['error in an array', nested([new TypeError(`to ${MOBILE}`)])],
    ['error field', { err: Object.assign(new Error('x'), { phone: MOBILE }) }],
    ['error cause', { err: new Error('x', { cause: { detail: MOBILE } }) }],
    ['beyond the depth cap', JSON.parse('{"a":'.repeat(12) + `"${MOBILE}"` + '}'.repeat(12))],
    [
      'cycle next to a number',
      (() => {
        const o: Record<string, unknown> = { detail: MOBILE };
        o.me = o;
        return o;
      })(),
    ],
    ['buffer holding a number', nested(Buffer.from(MOBILE))],
    ['token in headers', nested({ headers: { cookie: 'heach_refresh=abc', 'x-otp': '123456' } })],
    ['address object', nested({ address: { line1: '12 Lane', pin: '751001' } })],
  ];

  it.each(corpus)('SC-002 writes no synthetic value in clear: %s', (_label, value) => {
    const text = asText(sanitizeLogValue(value));
    expect(text).not.toMatch(/98765432\d\d|Asha|heach_refresh=abc|123456|12 Lane/);
  });
});
