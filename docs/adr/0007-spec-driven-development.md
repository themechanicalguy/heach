# 0007. Build every step from a written, approved spec

- **Status:** Accepted
- **Date:** 2026-10-10
- **Requirements:** SO-01, TS-01 to TS-09, all requirement IDs

## Context

The requirements and guideline describe what to build and in what order, but most requirement IDs
are one-line statements without acceptance criteria, tests do not reference IDs, and several
decisions reached the code before the spec (branch protection in ADR 0004, the product name, the
delivery plan). "Done" was a judgment made by reading code. The application handles health data,
so what it must do, and how that is proven, has to be agreed before it is built.

## Decision

Development is spec driven. The spec leads; code follows it.

1. **Spec before code.** Before a step's code starts, a docs-only pull request adds its spec in
   [`docs/specs/`](../specs/README.md) from the template: requirement IDs in scope, testable
   acceptance criteria per ID, new data fields with their class, API endpoints with the roles
   allowed, and the threat model (SO-01). Code PRs for that step start after it is merged.
2. **Spec changes first.** When behaviour must differ from the spec, the requirements, guideline or
   step spec is changed in the same pull request or an earlier one, never afterwards. A decision
   with trade-offs also gets an ADR.
3. **Tests name what they prove.** Each acceptance criterion has an ID (`EN-03.1`) and at least one
   automated test whose `describe` or `it` title starts with it, or a manual check recorded in the
   spec when it cannot be automated (for example a usability test).
4. **Done means every criterion passes.** An item is Done in
   [implementation status](../implementation-status.md) only when all of its criteria pass.
5. **API contract in the spec.** The step spec defines each endpoint (method, path, roles,
   request and response fields with classes, error cases) before it is built. The OpenAPI file
   stays generated from the NestJS code, and review checks it against the spec.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Step specs with acceptance criteria and test IDs (chosen) | Agreed, testable behaviour; traceable proof; small docs PR per step | A docs PR before each step's code |
| Keep one-line requirements, judge done in review | No extra documents | "Done" is subjective; spec drifts from code |
| Contract-first OpenAPI (hand-written YAML, code generated from it) | Contract is the single source | Second source of truth next to NestJS DTOs; extra tooling outside the stack |

## Consequences

- Each step starts with a spec PR; the guideline's step text is the outline, the step spec the
  detail.
- Existing Step 1 tests (`/healthz`, `/readyz`) carry no IDs; tests written from Step 2 onward do.
- Revisit contract-first OpenAPI if review against the spec misses API drift, or when external
  parties integrate with the API.
