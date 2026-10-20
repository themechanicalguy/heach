# Agent guide

For any coding agent working in this repository. HEACH handles health data of patients in
Odisha; security and data protection come before speed. This file is an entry point and holds no
rules of its own. Read, in this order:

1. [Constitution](.specify/memory/constitution.md): principles and gates, and what an agent may
   and may not approve.
2. [`CLAUDE.md`](CLAUDE.md): the full working rules, stack, layout, code style and commands. They
   apply to every agent, not only Claude Code.
3. [Spec workflow](docs/spec-workflow.md): how a feature goes from `/speckit-specify` to merged
   code, and how to select or resume a feature.
4. [Specs index](docs/specs/README.md), then the spec you are working from.

Spec Kit commands are set up for Claude Code (`.claude/skills/`, typed as `/speckit-<command>`).
Another agent can follow the same steps by reading the matching `SKILL.md` and the templates in
`.specify/templates/overrides/`, but must not create a second Spec Kit integration without an ADR.

Before you finish any change: `pnpm check` passes, `docs/implementation-status.md` is updated
when a requirement ID or step item moves, and the pull request names its spec and criterion IDs.
