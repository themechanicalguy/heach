import { detailsErrors, type DetailsForm, validPart } from './details-form';

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
