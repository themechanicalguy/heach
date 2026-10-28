import type { Me } from '@heach/types';
import { destinationFor, inLocale, safeNext } from './routing';

const base: Me = {
  locale: 'or',
  mobile: '••••••0001',
  activeRole: 'patient',
  roles: [{ role: 'patient', side: 'care', applicationStatus: null, statusReason: null }],
  setup: {
    complete: true,
    nextStep: null,
    draft: {
      role: 'patient',
      fullName: 'Synthetic',
      gender: 'female',
      languages: [],
      organisationName: null,
      adultDeclared: true,
    },
  },
  consentsDue: [],
};

describe('Safe redirects', () => {
  it.each([
    ['/or/account', '/or/account'],
    ['/hi/provider?x=1#y', '/hi/provider'],
    ['/en', '/en'],
  ])('SE-02 follows %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it.each([
    'https://evil.example/or',
    '//evil.example/or',
    '/\\evil.example',
    '/%2F%2Fevil.example',
    'javascript:alert(1)',
    '/fr/account',
    '/or/sign-in',
    '/or/welcome',
    'or/account',
    '',
    null,
  ])('SE-02 refuses %s', (next) => {
    expect(safeNext(next)).toBeUndefined();
  });

  it('AC-02 moves a path to another language', () => {
    expect(inLocale('/or/account', 'hi')).toBe('/hi/account');
    expect(inLocale('/or', 'en')).toBe('/en');
  });
});

describe('Routing after sign-in', () => {
  it('PO-03 an unfinished setup resumes at its next step, in the account language', () => {
    const me = {
      ...base,
      locale: 'hi' as const,
      setup: { ...base.setup, complete: false, nextStep: 'details' as const },
    };
    expect(destinationFor(me, '/or/account')).toBe('/hi/setup/details');
  });

  it('PR-01 a consent that is due comes before anything else', () => {
    expect(destinationFor({ ...base, consentsDue: [{ purpose: 'terms', version: 'v2' }] })).toBe(
      '/or/consent',
    );
  });

  it('AC-04 a returning patient goes home or where they asked', () => {
    expect(destinationFor(base)).toBe('/or');
    expect(destinationFor(base, '/en/account')).toBe('/or/account');
  });

  it('AC-04 providers go to their application; patients never to provider pages', () => {
    const nurse = { ...base, activeRole: 'nurse' as const };
    expect(destinationFor(nurse)).toBe('/or/provider');
    expect(destinationFor(base, '/or/provider')).toBe('/or');
  });
});
