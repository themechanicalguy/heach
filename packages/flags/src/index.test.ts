import { FeatureFlags } from './index.js';

describe('FeatureFlags', () => {
  it('FF-01.1 defaults to off when unset', () => {
    expect(new FeatureFlags('dev', undefined).isOn('sample-patient-note')).toBe(false);
    expect(new FeatureFlags('dev', '').isOn('sample-patient-note')).toBe(false);
  });

  it('FF-01.1 is set per environment', () => {
    expect(new FeatureFlags('dev', 'sample-patient-note').isOn('sample-patient-note')).toBe(true);
    expect(
      new FeatureFlags('test', ' other, sample-patient-note ').isOn('sample-patient-note'),
    ).toBe(true);
  });

  it('FF-01.1 keeps the sample flag off outside dev and test even when listed', () => {
    expect(new FeatureFlags('staging', 'sample-patient-note').isOn('sample-patient-note')).toBe(
      false,
    );
    expect(new FeatureFlags('production', 'sample-patient-note').isOn('sample-patient-note')).toBe(
      false,
    );
  });

  it('L-13 keeps the accounts flag off outside local, test and dev', () => {
    expect(new FeatureFlags('dev', 'accounts').isOn('accounts')).toBe(true);
    expect(new FeatureFlags('staging', 'accounts').isOn('accounts')).toBe(false);
    expect(new FeatureFlags('production', 'accounts').isOn('accounts')).toBe(false);
  });

  it('AC-04 keeps the deferred doctor and clinic roles off unless listed, and never in staging or production (ADR 0015)', () => {
    expect(new FeatureFlags('dev', 'accounts').isOn('doctor-and-clinic')).toBe(false);
    expect(new FeatureFlags('dev', 'doctor-and-clinic').isOn('doctor-and-clinic')).toBe(true);
    expect(new FeatureFlags('staging', 'doctor-and-clinic').isOn('doctor-and-clinic')).toBe(false);
    expect(new FeatureFlags('production', 'doctor-and-clinic').isOn('doctor-and-clinic')).toBe(
      false,
    );
  });
});
