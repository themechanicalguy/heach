import {
  grievanceOfficer,
  parseCount,
  parseHours,
  parseLanguages,
  siteConfig,
} from './site-config';

const officer = {
  SITE_GRIEVANCE_NAME: 'Synthetic Officer',
  SITE_GRIEVANCE_EMAIL: 'grievance@heach.example',
  SITE_GRIEVANCE_PHONE: '+910000000000',
  SITE_GRIEVANCE_ACK_HOURS: '24',
  SITE_GRIEVANCE_RESOLVE_DAYS: '15',
};

it('accepts only well-formed helpline hours', () => {
  expect(parseHours(' 08:00-20:00 ')).toEqual({ open: '08:00', close: '20:00' });
  for (const value of [undefined, '', '8-20', '08:00-24:00', '08:60-20:00', '08:00 to 20:00']) {
    expect(parseHours(value)).toBeUndefined();
  }
});

it('keeps supported languages in order without repeats', () => {
  expect(parseLanguages('or, en,or,xx,hi')).toEqual(['or', 'en', 'hi']);
  expect(parseLanguages('xx')).toBeUndefined();
  expect(parseLanguages(undefined)).toBeUndefined();
});

it('accepts whole numbers within bounds only', () => {
  expect(parseCount('15', 90)).toBe(15);
  for (const value of [undefined, '0', '-1', '1.5', '91', 'ten']) {
    expect(parseCount(value, 90)).toBeUndefined();
  }
});

it('publishes the grievance officer only when every required field is confirmed', () => {
  expect(grievanceOfficer(officer)).toEqual({
    name: 'Synthetic Officer',
    email: 'grievance@heach.example',
    phone: '+910000000000',
    acknowledgeHours: 24,
    resolveDays: 15,
  });
  for (const key of Object.keys(officer)) {
    expect(grievanceOfficer({ ...officer, [key]: ' ' })).toBeUndefined();
  }
});

it('reads only the public SITE_* allowlist', () => {
  const config = siteConfig({ SITE_CIN: 'U00000OD0000PTC000000', DATABASE_URL: 'not-public' });
  expect(config.cin).toBe('U00000OD0000PTC000000');
  expect(JSON.stringify(config)).not.toContain('not-public');
});
