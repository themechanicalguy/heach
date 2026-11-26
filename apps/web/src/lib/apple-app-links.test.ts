import { appleAppSiteAssociation } from './apple-app-links';

it('lists no app until the signing team is configured (MA-06)', () => {
  expect(appleAppSiteAssociation({})).toEqual({ applinks: { details: [] } });
  expect(appleAppSiteAssociation({ APPLE_TEAM_ID: 'not-a-team' })).toEqual({
    applinks: { details: [] },
  });
});

it('gives the provider area to the provider app and the rest to the patient app', () => {
  const [provider, patient] = appleAppSiteAssociation({ APPLE_TEAM_ID: ' AB12CD34EF ' }).applinks
    .details;
  expect(provider?.appIDs).toEqual(['AB12CD34EF.in.heach.provider']);
  expect(provider?.components).toContainEqual({ '/': '/*/provider/*' });
  expect(patient?.appIDs).toEqual(['AB12CD34EF.in.heach.patient']);
  expect(patient?.components.at(0)).toEqual({ '/': '/provider', exclude: true });
  expect(patient?.components.at(-1)).toEqual({ '/': '*' });
});
