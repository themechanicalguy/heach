import { FeatureFlags } from '@heach/flags';
import { RoleAvailability } from './role-availability.js';

const availability = (env: 'test' | 'dev' | 'staging' | 'production', flags: string) =>
  new RoleAvailability(new FeatureFlags(env, flags));
const DEFERRED = ['doctor', 'dentist', 'dermatologist', 'clinic_front_desk'];
const MVP = [
  'patient',
  'representative',
  'physiotherapist',
  'nurse',
  'attendant',
  'lab',
  'sample_collector',
];

describe('RoleAvailability (ADR 0015)', () => {
  it('AC-04 deferred roles are not offered while doctor-and-clinic is off; MVP roles always are', () => {
    const roles = availability('dev', 'accounts');
    expect(DEFERRED.map((role) => roles.isOffered(role))).toEqual([false, false, false, false]);
    expect(MVP.every((role) => roles.isOffered(role))).toBe(true);
  });

  it('AC-04 the flag offers them only where it is allowed: never in staging or production', () => {
    expect(availability('dev', 'doctor-and-clinic').isOffered('doctor')).toBe(true);
    expect(availability('test', 'doctor-and-clinic').isOffered('dentist')).toBe(true);
    expect(availability('staging', 'accounts,doctor-and-clinic').isOffered('doctor')).toBe(false);
    expect(availability('production', 'accounts,doctor-and-clinic').isOffered('doctor')).toBe(
      false,
    );
  });

  it('AC-04 grants are kept and marked, never dropped', () => {
    const held = availability('production', 'accounts').held([
      { role: 'patient', side: 'care' },
      { role: 'dermatologist', side: 'provider' },
    ]);
    expect(held).toEqual([
      { role: 'patient', side: 'care', available: true },
      { role: 'dermatologist', side: 'provider', available: false },
    ]);
  });
});
