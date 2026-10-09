# Architecture decision records

Each file records one significant decision: context, decision, options and consequences.
Start from [the template](0000-template.md) and take the next number.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-and-stack.md) | TypeScript monorepo with pnpm and Turborepo | Accepted |
| [0002](0002-local-services.md) | Local services with Docker Compose, SeaweedFS and Mailpit | Accepted |
| [0003](0003-quality-gates-without-new-dependencies.md) | Quality gates with git hooks, gitleaks and CI | Accepted |
| [0004](0004-github-free-no-branch-protection.md) | GitHub Free, private, no branch protection | Accepted |
| [0005](0005-aws-dev-environment.md) | One AWS dev host in Mumbai, managed with OpenTofu | Accepted |
| [0006](0006-infra-layout-and-state.md) | Infra modules, per-environment stacks, one state each | Accepted |
| [0007](0007-spec-driven-development.md) | Build every step from a written, approved spec | Accepted |
