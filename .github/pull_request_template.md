## What and why

<!-- What this changes, which requirement IDs it covers (for example BK-03), and why. -->

## How to check

<!-- Commands or steps a reviewer can run. -->

## Definition of done

Tick what applies; explain any unticked item. Full list in `docs/mvp-v1-requirements.md`.

- [ ] Works at 360 px, 768 px and 1280 px
- [ ] No hard-coded user-facing strings; translations present
- [ ] Unit tests added or updated; E2E updated for affected journeys
- [ ] Accessibility checks pass; keyboard and screen-reader pass for new UI
- [ ] Loading, empty, error and offline states
- [ ] No personal or health data in logs, URLs, analytics or notifications
- [ ] New fields classified; Restricted fields encrypted with a test
- [ ] Authorisation tests prove other users and roles cannot read or change the data
- [ ] No secrets in code; no new dependency outside the stack without approval
- [ ] OpenAPI and Storybook updated where relevant
