import {
  consentsDue,
  coversCurrentVersions,
  CURRENT_CONSENT_VERSIONS,
} from './consent-versions.js';

const terms = { purpose: 'terms' as const, version: CURRENT_CONSENT_VERSIONS.terms };
const privacy = { purpose: 'privacy' as const, version: CURRENT_CONSENT_VERSIONS.privacy };
const current = [terms, privacy];

describe('Versioned consent (PR-01, L-12)', () => {
  it('PR-01 both purposes are due for a new account', () => {
    expect(consentsDue([]).map((c) => c.purpose)).toEqual(['terms', 'privacy']);
  });

  it('PR-01 nothing is due once the current versions are given', () => {
    expect(consentsDue(current)).toEqual([]);
    expect(coversCurrentVersions(current)).toBe(true);
  });

  it('PR-01 an older version of a text makes that purpose due again', () => {
    const old = [terms, { purpose: 'privacy' as const, version: '2020-01' }];
    expect(consentsDue(old)).toEqual([privacy]);
    expect(coversCurrentVersions(old)).toBe(false);
  });
});
