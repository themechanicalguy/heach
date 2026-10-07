# 0001. Use a TypeScript monorepo with pnpm and Turborepo

- **Status:** Accepted
- **Date:** 2026-10-03
- **Requirements:** Architecture and tech stack section; UX-01; I18N-02

## Context

Three apps (patient and provider web, admin, API) must share a design system, translations,
types, lint rules, and security code such as encryption and logging. One team will build all
of them.

## Decision

One repository with pnpm workspaces and Turborepo: `apps/web` (Next.js), `apps/admin`
(React with Vite), `apps/api` (NestJS), and shared `packages/` (config, ui, i18n, types, crypto,
logger). TypeScript strict everywhere. Node 24 LTS and pnpm versions are pinned.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| pnpm + Turborepo monorepo | Shared code without publishing; one CI; cached builds | Tooling to learn; one large repo |
| Separate repositories | Independent deploys | Shared code must be published and versioned; drift |
| Nx | Rich generators | Heavier; not in the recommended stack |

## Consequences

- Shared packages build before the apps (`^build`) and hot-reload in `pnpm dev`.
- Versions pinned exactly; TypeScript 6.0 until typescript-eslint supports 7.
- Vite was chosen for admin because the stack only said "React single-page app".
