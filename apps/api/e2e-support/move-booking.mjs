// Browser E2E only: moves one booking, and its shifts, to start a few minutes from now (or ago)
// with the same length, so the provider can start with the patient's code (a code works from 30
// minutes before the start). Refuses to run anywhere but local and test.
// Usage: node --env-file=../../.env e2e-support/move-booking.mjs <id> [minutes, default 5]
import process from 'node:process';
import pg from 'pg';
import { pgClientConfig } from '../dist/db/connection.js';

if (!['local', 'test'].includes(process.env.APP_ENV ?? '')) {
  process.stderr.write('Refused: local and test only\n');
  process.exit(1);
}
const [bookingId, minutesArg = '5'] = process.argv.slice(2);
const minutes = Number(minutesArg);
if (!/^[0-9a-f-]{36}$/.test(bookingId ?? '') || !Number.isInteger(minutes)) {
  process.stderr.write('Usage: move-booking.mjs <booking id>\n');
  process.exit(1);
}
const client = new pg.Client(
  pgClientConfig(
    process.env.DATABASE_ADMIN_URL ?? '',
    process.env.DATABASE_ADMIN_PASSWORD,
    process.env.DATA_TLS_CA_FILE ?? '',
  ),
);
await client.connect();
await client.query(
  `UPDATE app.booking SET starts_at = now() + make_interval(mins => $2),
          ends_at = now() + make_interval(mins => $2) + (ends_at - starts_at) WHERE id = $1`,
  [bookingId, minutes],
);
await client.query(
  `UPDATE app.shift s SET starts_at = b.starts_at + make_interval(days => s.day_index),
          ends_at = b.starts_at + make_interval(days => s.day_index) + (s.ends_at - s.starts_at)
     FROM app.booking b WHERE b.id = s.booking_id AND b.id = $1`,
  [bookingId],
);
await client.end();
