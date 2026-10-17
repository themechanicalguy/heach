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
});
