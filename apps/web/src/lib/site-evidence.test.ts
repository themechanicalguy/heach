import { approvedEvidence } from './site-evidence';

const metrics = {
  approved: true,
  source: 'live',
  providers: 3,
  visits: 4,
  cities: 1,
  asOf: '2026-10-01',
};
const review = {
  firstName: 'Synthetic',
  service: 'nursing',
  text: 'Synthetic review of clear prices.',
  locale: 'en',
};
const reviews = {
  approved: true,
  consentConfirmed: true,
  healthDetailsRemoved: true,
  items: [review, review, review],
};

it('hides missing, malformed, unapproved and undated business claims', () => {
  expect(approvedEvidence(undefined, undefined)).toEqual({});
  expect(approvedEvidence('{', '{')).toEqual({});
  for (const changes of [
    { approved: false },
    { asOf: '' },
    { source: 'sample' },
    { visits: -1 },
    { asOf: '2026-02-30' },
  ])
    expect(approvedEvidence(JSON.stringify({ ...metrics, ...changes }), undefined)).toEqual({});
});
it('requires review approval, consent, removal of health details and first-name-only attribution', () => {
  for (const changes of [
    { approved: false },
    { consentConfirmed: false },
    { healthDetailsRemoved: false },
    { items: [review] },
    { items: [{ ...review, firstName: 'Full Name' }, review, review] },
  ])
    expect(approvedEvidence(undefined, JSON.stringify({ ...reviews, ...changes }))).toEqual({});
});
it('publishes only the allowed fields from approved content', () => {
  const result = approvedEvidence(
    JSON.stringify({ ...metrics, secret: 'excluded' }),
    JSON.stringify(reviews),
  );
  expect(result.metrics).toEqual({ providers: 3, visits: 4, cities: 1, asOf: '2026-10-01' });
  expect(result.reviews).toEqual([review, review, review]);
});
