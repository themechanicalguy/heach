import type { Me } from '@heach/types';
import { CARE_CHOICES, offered, PROVIDER_CHOICES } from './roles';

const MVP: Pick<Me, 'offeredRoles'> = {
  offeredRoles: ['patient', 'representative', 'physiotherapist', 'nurse', 'attendant', 'lab'],
};

describe('roles on offer (ADR 0015)', () => {
  it('AC-04 the screens offer only what the API offers: no doctor, dentist or dermatologist in the MVP', () => {
    expect(offered(PROVIDER_CHOICES, MVP)).toEqual([
      'physiotherapist',
      'nurse',
      'attendant',
      'lab',
    ]);
    expect(offered(CARE_CHOICES, MVP)).toEqual(['patient', 'representative']);
  });

  it('AC-04 where the API offers the deferred roles (flag on, dev and test only), so do the screens', () => {
    const all: Pick<Me, 'offeredRoles'> = { offeredRoles: [...CARE_CHOICES, ...PROVIDER_CHOICES] };
    expect(offered(PROVIDER_CHOICES, all)).toEqual([...PROVIDER_CHOICES]);
  });
});
