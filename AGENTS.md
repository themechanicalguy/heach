# Agent guide

For any coding agent working in this repository. HEACH handles health data of patients in
Odisha; security and data protection come before speed. This file is an entry point and holds no
rules of its own. Read, in this order:

1. [`CLAUDE.md`](CLAUDE.md): the full working rules, stack, layout, code style and commands. They
   apply to every agent, not only Claude Code.
2. [Requirements](docs/mvp-v1-requirements.md) and the
   [implementation guideline](docs/mvp-v1-implementation-guideline.md): what to build and in what
   order.
3. [Implementation status](docs/implementation-status.md) and the
   [follow-up register](docs/follow-up-register.md): what exists and what is still due.

Retired step and feature specs are in [`docs/archive/`](docs/archive/README.md) as a historical
record only ([ADR 0013](docs/adr/0013-retire-spec-driven-development.md)).

Before you finish any change: `pnpm check` passes, and `docs/implementation-status.md` is updated
when a requirement ID or step item moves.
