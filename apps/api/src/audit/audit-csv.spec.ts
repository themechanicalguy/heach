import { auditCsv, csvCell } from './audit-csv.js';
import type { AuditEntryDto } from './audit-search.dto.js';

const ENTRY = {
  seq: '7',
  id: '3f1c2a52-0000-4000-8000-000000000001',
  at: '2026-11-12T10:00:00.000Z',
  actorId: null,
  actorRole: 'system',
  action: 'admin.create',
  entity: 'admin',
  entityId: 'abc',
  correlationId: 'req-1',
} satisfies AuditEntryDto;

describe('csvCell (AD-11)', () => {
  it('quotes the value and doubles embedded quotes', () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
  });

  it('writes null as an empty cell', () => {
    expect(csvCell(null)).toBe('""');
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'neutralises the formula start %j',
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('leaves a formula character that is not first alone', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
  });
});

describe('auditCsv (AD-11)', () => {
  it('starts with the header row and keeps the order given', () => {
    const lines = auditCsv([ENTRY, { ...ENTRY, seq: '6' }]).split('\r\n');
    expect(lines[0]).toBe(
      '"seq","id","at","actorId","actorRole","action","entity","entityId","correlationId"',
    );
    expect(lines[1]).toContain('"7"');
    expect(lines[2]).toContain('"6"');
    expect(lines[3]).toBe('');
  });

  it('keeps newlines inside a quoted cell', () => {
    expect(auditCsv([{ ...ENTRY, action: 'a\nb' }])).toContain('"a\nb"');
  });
});
