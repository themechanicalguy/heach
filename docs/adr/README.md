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
| [0007](0007-spec-driven-development.md) | Build every step from a written, approved spec | Accepted; amended by 0011 when accepted |
| [0008](0008-lean-single-host-on-credits.md) | One lean EC2 host on AWS credits until the paid plan | Accepted |
| [0009](0009-aws-credits-and-restricted-pilot.md) | Free plan credits, upgrade at the Act level, pilot on an IP address | Accepted |
| [0010](0010-step-2-backups-secrets-waf.md) | Step 2: one-Region backups, Parameter Store secrets, WAF at the pilot | Accepted |
| [0011](0011-spec-kit-feature-specs.md) | Feature specs with GitHub Spec Kit under the step specs (amends 0007) | Proposed |
