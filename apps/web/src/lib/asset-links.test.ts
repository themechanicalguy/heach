import { assetLinks } from './asset-links';

const PRINT = Array.from({ length: 32 }, () => 'AB').join(':');

it('lists no app until a signing fingerprint is configured (MA-06)', () => {
  expect(assetLinks({})).toEqual([]);
  expect(assetLinks({ ANDROID_PATIENT_CERT_SHA256: 'not-a-fingerprint' })).toEqual([]);
});

it('lists each app with its fingerprints, upper-cased', () => {
  const links = assetLinks({
    ANDROID_PATIENT_CERT_SHA256: `${PRINT.toLowerCase()}, ${PRINT}`,
    ANDROID_PROVIDER_CERT_SHA256: PRINT,
  });
  expect(links.map((link) => link.target.package_name)).toEqual([
    'in.heach.patient',
    'in.heach.provider',
  ]);
  expect(links[0]?.target.sha256_cert_fingerprints).toEqual([PRINT, PRINT]);
  expect(links[1]?.relation).toEqual(['delegate_permission/common.handle_all_urls']);
});
