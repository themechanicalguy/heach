import {
  type ApplicationFacts,
  canSubmit,
  decide,
  missingForSubmit,
  opensReview,
} from './application-rules.js';
import { checklistItem, isOnboardingRole, needsPayout } from './checklists.js';

const nurse = (overrides: Partial<ApplicationFacts> = {}): ApplicationFacts => ({
  role: 'nurse',
  identityVerified: true,
  payoutOnFile: true,
  today: '2026-10-30',
  documents: new Map([
    ['nursing_registration', { reference: true, expiresOn: '2027-10-30' }],
    ['qualification_certificate', { reference: false, expiresOn: null }],
    ['police_verification', { reference: true, expiresOn: '2027-01-01' }],
  ]),
  ...overrides,
});

describe('Provider application rules (PO-01, PO-04)', () => {
  it('PO-01 a complete nurse application has nothing missing', () => {
    expect(missingForSubmit(nurse())).toEqual([]);
  });

  it('PO-01 lists identity, payout and each missing, unnumbered or expired document', () => {
    const documents = new Map([
      ['nursing_registration', { reference: false, expiresOn: '2027-10-30' }],
      ['police_verification', { reference: true, expiresOn: '2026-10-30' }],
    ]);
    expect(
      missingForSubmit(nurse({ identityVerified: false, payoutOnFile: false, documents })),
    ).toEqual([
      'identity',
      'nursing_registration',
      'qualification_certificate',
      'police_verification',
      'payout',
    ]);
  });

  it('PO-01 optional items may be left out; sample collectors need no payout details', () => {
    const facts: ApplicationFacts = {
      role: 'sample_collector',
      identityVerified: true,
      payoutOnFile: false,
      today: '2026-10-30',
      documents: new Map([
        ['qualification_certificate', { reference: false, expiresOn: null }],
        ['police_verification', { reference: true, expiresOn: '2027-01-01' }],
      ]),
    };
    expect(missingForSubmit(facts)).toEqual([]);
    expect(needsPayout('sample_collector')).toBe(false);
    expect(checklistItem('physiotherapist', 'council_registration')?.required).toBe(false);
    expect(checklistItem('nurse', 'unknown')).toBeUndefined();
    expect(isOnboardingRole('doctor')).toBe(false);
  });

  it('PO-04 submits only from Draft or Changes requested; review opens from Submitted', () => {
    expect(canSubmit('draft')).toBe(true);
    expect(canSubmit('changes_requested')).toBe(true);
    expect(canSubmit('submitted')).toBe(false);
    expect(opensReview('submitted')).toBe(true);
    expect(opensReview('approved')).toBe(false);
  });

  it('AD-02 decisions apply only to an application under review or submitted', () => {
    expect(decide('under_review', 'approve')).toBe('approved');
    expect(decide('submitted', 'reject')).toBe('rejected');
    expect(decide('under_review', 'request_changes')).toBe('changes_requested');
    expect(decide('draft', 'approve')).toBeUndefined();
    expect(decide('approved', 'reject')).toBeUndefined();
  });
});
