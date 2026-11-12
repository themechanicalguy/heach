import type { AccountRecord, RoleGrant } from '../accounts/account.repository.js';
import type { Principal } from '../common/request-context.js';
import type { ApplicationDto } from '../onboarding/onboarding.dto.js';
import { assistedOrigin, consentRefusal, toAssistedView } from './assisted-rules.js';

type Subject = Pick<AccountRecord, 'status' | 'deletionRequestedAt' | 'roles'>;

const offered = () => true;
const grant = (role: RoleGrant['role'], applicationStatus: RoleGrant['applicationStatus']) =>
  ({ role, side: 'provider', applicationStatus, statusReason: null }) satisfies RoleGrant;
const subject = (overrides: Partial<Subject> = {}): Subject => ({
  status: 'active',
  deletionRequestedAt: null,
  roles: [],
  ...overrides,
});

describe('AD-12 consentRefusal', () => {
  it('lets a new or care-only account through', () => {
    expect(consentRefusal(subject(), offered)).toBeNull();
    const care: RoleGrant = {
      role: 'patient',
      side: 'care',
      applicationStatus: null,
      statusReason: null,
    };
    expect(consentRefusal(subject({ roles: [care] }), offered)).toBeNull();
  });

  it('lets an editable application of an assisted role through', () => {
    for (const status of ['draft', 'changes_requested'] as const) {
      const roles = [grant('nurse', status)];
      expect(consentRefusal(subject({ roles }), offered)).toBeNull();
    }
  });

  it('refuses a suspended account first, then a pending deletion', () => {
    const both = subject({ status: 'suspended', deletionRequestedAt: new Date() });
    expect(consentRefusal(both, offered)).toEqual({ status: 403, code: 'account_suspended' });
    const deleting = subject({ deletionRequestedAt: new Date() });
    expect(consentRefusal(deleting, offered)).toEqual({ status: 409, code: 'deletion_pending' });
  });

  it('refuses a deferred role that is not offered, and a role outside the assisted set', () => {
    const doctor = subject({ roles: [grant('doctor', 'draft')] });
    expect(consentRefusal(doctor, (role) => role !== 'doctor')).toEqual({
      status: 409,
      code: 'role_unavailable',
    });
    const collector = subject({ roles: [grant('sample_collector', 'draft')] });
    expect(consentRefusal(collector, offered)).toEqual({ status: 409, code: 'role_not_assisted' });
  });

  it('refuses an application that can no longer be edited', () => {
    for (const status of [
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'suspended',
    ] as const) {
      const roles = [grant('attendant', status)];
      expect(consentRefusal(subject({ roles }), offered)).toEqual({
        status: 409,
        code: 'application_not_editable',
      });
    }
  });
});

const SECRET = 'SECRET-VALUE';
const application: ApplicationDto = {
  role: 'nurse',
  status: 'draft',
  statusReason: null,
  identity: 'in_review',
  identityMethod: 'manual',
  identityDocumentKind: 'voter_id',
  identityConsentVersion: 'v1',
  identityNameMatch: 'match',
  identityDetailsVerified: true,
  profile: { qualifications: null, experienceYears: null, hasPhoto: false, photoVerified: false },
  needsPayout: true,
  payout: { method: 'upi', holderName: SECRET, hint: SECRET },
  items: [
    {
      key: 'nursing_registration',
      required: true,
      reference: true,
      expiry: true,
      document: {
        id: 'a8f1a3a0-0000-4000-8000-000000000001',
        scanStatus: 'clean',
        reference: SECRET,
        expiresOn: SECRET,
        reviewStatus: 'pending',
        reviewReason: null,
        uploadedAt: new Date(0),
        source: 'digilocker',
        issuer: SECRET,
      },
    },
  ],
  missing: ['payout'],
  editable: true,
};

const plain = (value: ApplicationDto): ApplicationDto => structuredClone(value);

describe('AD-12 toAssistedView', () => {
  it('removes references, expiry dates, issuers, payout details and identity method', () => {
    const view = toAssistedView(application);
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(view).not.toHaveProperty('payout');
    for (const field of ['identityMethod', 'identityDocumentKind', 'identityNameMatch']) {
      expect(view).not.toHaveProperty(field);
    }
    expect(view).not.toHaveProperty('identityDetailsVerified');
    expect(view.items[0]?.document).not.toHaveProperty('id');
  });

  it('keeps what the admin needs to continue and shows only that a payout is on file', () => {
    const view = toAssistedView(application);
    expect(view).toMatchObject({
      role: 'nurse',
      status: 'draft',
      identity: 'in_review',
      needsPayout: true,
      payoutOnFile: true,
      missing: ['payout'],
      editable: true,
    });
    expect(view.items[0]).toMatchObject({ key: 'nursing_registration', reference: true });
    const withoutPayout = Object.assign(plain(application), { payout: null });
    expect(toAssistedView(withoutPayout).payoutOnFile).toBe(false);
  });
});

describe('AD-12 assistedOrigin', () => {
  it('ties the throttle to the admin and the client address', () => {
    const admin = { userId: 'admin-1' } as Principal;
    const request = { ip: '203.0.113.7' } as never;
    expect(assistedOrigin(admin, request)).toEqual({
      deviceId: 'admin:admin-1',
      address: '203.0.113.7',
    });
  });
});
