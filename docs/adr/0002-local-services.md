# 0002. Run local services with Docker Compose, SeaweedFS and Mailpit

- **Status:** Accepted
- **Date:** 2026-10-07
- **Requirements:** SO-07, EN-01, NT-01, TS-03

## Context

Developers need PostgreSQL, Redis, S3-compatible storage and a way to catch email and SMS, with
no real messages sent and no real data used. MinIO, the usual local S3, no longer publishes
Docker images.

## Decision

`docker-compose.yml` with PostgreSQL 18, Redis 8, SeaweedFS (S3) and Mailpit, pinned by version,
ports bound to `127.0.0.1`, credentials only from `.env`. `pnpm dev:up` picks free ports when
another program holds one. SMS in local mode is delivered to Mailpit as email (Step 2 adapter).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| SeaweedFS (chosen) | Apache-2.0, mature, single container | Larger image (about 690 MB) |
| RustFS | Apache-2.0 | Only recently at 1.0 |
| Garage | Lightweight | AGPL |
| MinIO | Familiar | No published images |

## Consequences

- Local connections do not use TLS; staging and production must (EN-01).
- PostgreSQL defaults to port 5433 to coexist with other local servers.
- CI runs PostgreSQL and Redis as service containers for integration tests.
