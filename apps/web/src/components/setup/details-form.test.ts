import { correctionFrom, detailsErrors, type DetailsForm, validPart } from './details-form';
import { isProviderChoice, isStaffRole } from './roles';

const complete: DetailsForm = {
  fullName: 'ସୀତା ସାହୁ',
  gender: 'female',
  languages: ['or'],
  organisationName: '',
  adultDeclared: true,
};

describe('Setup details validation (A11Y-04, PO-03)', () => {
  it('A11Y-04 a patient needs name, gender and the adult declaration', () => {
    expect(detailsErrors({ ...complete, languages: [] }, 'patient')).toEqual([]);
    expect(
      detailsErrors({ ...complete, fullName: '', gender: '', adultDeclared: false }, 'patient'),
    ).toEqual(['fullName', 'gender', 'adult']);
  });

  it('I18N-04 names in Odia, Devanagari and Latin pass; digits and markup do not', () => {
    for (const fullName of ['ସୀତା ସାହୁ', 'सीता साहू', "D'Souza-Rath"]) {
      expect(detailsErrors({ ...complete, fullName }, 'patient')).toEqual([]);
    }
    for (const fullName of ['Sita 2', '<b>Sita</b>', 'x'.repeat(101)]) {
      expect(detailsErrors({ ...complete, fullName }, 'patient')).toEqual(['fullName']);
    }
  });

  it('PO-01 providers need a language; labs need their name', () => {
    expect(detailsErrors({ ...complete, languages: [] }, 'nurse')).toEqual(['languages']);
    expect(detailsErrors(complete, 'lab')).toEqual(['organisation']);
  });

  it('PO-03 saving for later sends only the valid fields', () => {
    expect(validPart({ ...complete, fullName: '1' }, 'nurse')).toEqual({
      languages: ['or'],
      gender: 'female',
      adultDeclared: true,
    });
  });
});

describe('profile correction body (AC-06)', () => {
  const form = {
    fullName: ' Sita ',
    gender: 'female' as const,
    languages: ['or'],
    organisationName: ' Synthetic Lab ',
    adultDeclared: true,
  };

  it('sends only the fields the role uses', () => {
    expect(correctionFrom(form, 'patient')).toEqual({ fullName: 'Sita', gender: 'female' });
    expect(correctionFrom(form, 'nurse')).toEqual({
      fullName: 'Sita',
      gender: 'female',
      languages: ['or'],
    });
    expect(correctionFrom(form, 'lab')).toMatchObject({ organisationName: 'Synthetic Lab' });
    expect(correctionFrom(form, 'sample_collector')).toEqual({
      fullName: 'Sita',
      gender: 'female',
    });
  });

  it('O-1 staff roles are not self-registrable and need no spoken languages', () => {
    expect(isStaffRole('sample_collector')).toBe(true);
    expect(isStaffRole('clinic_front_desk')).toBe(true);
    expect(isStaffRole('lab')).toBe(false);
    expect(isProviderChoice('sample_collector')).toBe(false);
  });
});
