import { describe, expect, it } from 'vitest';
import { EMPTY_LINKED, linkedBody, linkedErrors } from './linked-form';

describe('linked patient form (AC-03)', () => {
  it('requires every field and a plausible year of birth', () => {
    expect(linkedErrors(EMPTY_LINKED, 2026)).toEqual([
      'fullName',
      'birthYear',
      'gender',
      'relationship',
    ]);
    const filled = { fullName: 'ସମୀର', birthYear: '2016', gender: 'male', relationship: 'child' };
    expect(linkedErrors(filled, 2026)).toEqual([]);
    expect(linkedErrors({ ...filled, birthYear: '2027' }, 2026)).toEqual(['birthYear']);
    expect(linkedErrors({ ...filled, birthYear: '1899' }, 2026)).toEqual(['birthYear']);
    expect(linkedErrors({ ...filled, fullName: '<b>' }, 2026)).toEqual(['fullName']);
  });

  it('sends the year as a number and the name trimmed', () => {
    const form = {
      fullName: ' Sita ',
      birthYear: '1950',
      gender: 'female',
      relationship: 'parent',
    };
    expect(linkedBody(form)).toEqual({
      fullName: 'Sita',
      birthYear: 1950,
      gender: 'female',
      relationship: 'parent',
    });
  });
});
