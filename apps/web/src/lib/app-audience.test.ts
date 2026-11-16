import { appAudience, appHome, offeredInApp } from './app-audience';

describe('appAudience (MA-08)', () => {
  it('reads the app from the user agent the Android shell appends', () => {
    expect(appAudience('Mozilla/5.0 (Linux; Android 16) Chrome/140 HeachApp/patient')).toBe(
      'patient',
    );
    expect(appAudience('Mozilla/5.0 HeachApp/provider')).toBe('provider');
  });

  it('is undefined in a browser or for an unknown app', () => {
    expect(appAudience('Mozilla/5.0 (Linux; Android 16) Chrome/140')).toBeUndefined();
    expect(appAudience('HeachApp/admin')).toBeUndefined();
    expect(appAudience(null)).toBeUndefined();
  });
});

describe('offeredInApp (MA-08)', () => {
  it('offers every page in a browser', () => {
    expect(offeredInApp(undefined, '/en/provider/requests')).toBe(true);
    expect(offeredInApp(undefined, '/en/bookings')).toBe(true);
  });

  it('keeps patient booking out of the provider app', () => {
    for (const path of ['/or', '/en/services/nursing', '/en/book/abc', '/hi/vault', '/en/plans'])
      expect(offeredInApp('provider', path)).toBe(false);
    expect(offeredInApp('provider', '/en/providers/123')).toBe(false);
  });

  it('keeps provider work out of the patient app', () => {
    for (const path of ['/en/provider', '/or/provider/requests', '/en/team', '/en/providers/join'])
      expect(offeredInApp('patient', path)).toBe(false);
    expect(offeredInApp('patient', '/en/providers/123')).toBe(true);
  });

  it('offers shared pages and joining as a provider where they belong', () => {
    for (const path of ['/en/account', '/en/sign-in', '/or/pages/terms', '/en/notifications']) {
      expect(offeredInApp('patient', path)).toBe(true);
      expect(offeredInApp('provider', path)).toBe(true);
    }
    expect(offeredInApp('provider', '/en/providers/join')).toBe(true);
  });
});

it('appHome is the first page of each app', () => {
  expect(appHome('provider', 'or')).toBe('/or/provider');
  expect(appHome('patient', 'hi')).toBe('/hi');
});
