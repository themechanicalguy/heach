## What and why

<!-- What this changes, which requirement IDs it covers (for example BK-03), and why. -->

## How to check

<!-- Commands or steps a reviewer can run. -->

## Definition of done

From `docs/mvp-v1-requirements.md`. Tick what applies; explain any unticked item.

- [ ] Acceptance criteria met and demonstrated on mobile (360 px), tablet (768 px) and desktop (1280 px)
- [ ] All strings externalised; Odia, English and Hindi translations present and reviewed
- [ ] Unit tests written; coverage threshold met on changed code
- [ ] E2E test added or updated for the affected journey
- [ ] Automated accessibility checks pass; keyboard and screen-reader pass done for new UI
- [ ] Performance budgets pass in CI (bundle size, Lighthouse)
- [ ] Loading, empty, error and offline states implemented
- [ ] Structured logs, metrics and error tracking added; no personal data in logs
- [ ] Analytics or business event emitted where the feature affects a funnel
- [ ] Every new field is classified (DC); Restricted fields are encrypted at field level and covered by an encryption test
- [ ] Authorisation tests prove other users and roles cannot read or change the data
- [ ] Threat model reviewed; security scans pass with no high-severity findings
- [ ] Reads of Restricted data write an audit entry; consent captured where the feature needs it
- [ ] API changes reflected in OpenAPI spec; component documented in Storybook
- [ ] Behind a feature flag if not ready for all users
- [ ] No secrets in code; no new dependency outside the stack without approval
