# HEACH

Healthcare services web application for Odisha, India: patients find, book and pay verified
care providers. See [`docs/`](docs/) for the requirements and implementation guideline, and
[`CLAUDE.md`](CLAUDE.md) for working rules.

## Getting started

Prerequisites: Node 24 LTS (see `.nvmrc`), pnpm (version pinned in `package.json`), Docker.

```sh
nvm use               # Node 24
pnpm install
pnpm setup            # creates .env from .env.example (local, never committed)
pnpm dev              # web :3000, admin :5173, api :3001
```

| App                       | URL                   | Checks                                    |
| ------------------------- | --------------------- | ----------------------------------------- |
| Web (patients, providers) | http://localhost:3000 | `/healthz`                                |
| Admin                     | http://localhost:5173 |                                           |
| API                       | http://localhost:3001 | `/healthz`, `/readyz`, OpenAPI at `/docs` |

All commands are listed in [`CLAUDE.md`](CLAUDE.md#commands).
