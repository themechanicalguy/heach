import {
  initialRole,
  isRegistrableRole,
  missingFields,
  nextSetupStep,
  type SetupDraft,
  sideOf,
} from './setup-rules.js';

const empty: SetupDraft = {
  role: null,
  fullName: null,
  gender: null,
  languages: [],
  organisationName: null,
  adultDeclared: false,
};

describe('Account setup rules (L-2, L-5)', () => {
  it('AC-04 clinic front desk, admin roles and unknown values cannot be chosen at registration', () => {
    expect(isRegistrableRole('nurse')).toBe(true);
    expect(isRegistrableRole('representative')).toBe(true);
    for (const role of ['clinic_front_desk', 'super_admin', 'verifier', 'new_account', 'x']) {
      expect(isRegistrableRole(role)).toBe(false);
    }
  });

  it('AC-04 patients and representatives are the care side; every other role is a provider', () => {
    expect(sideOf('patient')).toBe('care');
    expect(sideOf('representative')).toBe('care');
    expect(sideOf('attendant')).toBe('provider');
    expect(sideOf('lab')).toBe('provider');
  });

  it('PO-03 setup resumes at the first unfinished step', () => {
    expect(nextSetupStep(empty)).toBe('role');
    const patient = { ...empty, role: 'patient' as const };
    expect(nextSetupStep(patient)).toBe('details');
    expect(missingFields(patient)).toEqual(['fullName', 'gender', 'adult']);
    const done = {
      ...patient,
      fullName: 'Synthetic',
      gender: 'female' as const,
      adultDeclared: true,
    };
    expect(nextSetupStep(done)).toBe('consent');
  });

  it('PO-01 providers also give languages; labs also give the lab name', () => {
    const base = { ...empty, fullName: 'Synthetic', gender: 'male' as const, adultDeclared: true };
    expect(missingFields({ ...base, role: 'nurse' })).toEqual(['languages']);
    expect(missingFields({ ...base, role: 'nurse', languages: ['or'] })).toEqual([]);
    expect(missingFields({ ...base, role: 'lab', languages: ['or'] })).toEqual(['organisation']);
  });

  it('AC-05 a sign-in starts in the last role still granted, then care, then provider', () => {
    const care = { role: 'patient' as const, side: 'care' as const };
    const provider = { role: 'nurse' as const, side: 'provider' as const };
    expect(initialRole([], null)).toBe('new_account');
    expect(initialRole([provider, care], null)).toBe('patient');
    expect(initialRole([provider, care], 'nurse')).toBe('nurse');
    expect(initialRole([care], 'nurse')).toBe('patient');
    expect(initialRole([provider], 'patient')).toBe('nurse');
  });
});
