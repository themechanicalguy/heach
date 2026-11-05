// Direct database steps the API has no route for, local and test only: loading the Odisha PIN
// codes, moving a booking to start now so it can be carried out, and dating finished history back.
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';
import { pgClientConfig } from '../dist/db/connection.js';
import { CITIES } from './data.mjs';

export function refuseOutsideLocal() {
  if (!['local', 'test'].includes(process.env.APP_ENV ?? '')) {
    process.stderr.write('Refused: the demo seed runs against local and test only\n');
    process.exit(1);
  }
}

export async function connect() {
  const client = new pg.Client(
    pgClientConfig(
      process.env.DATABASE_ADMIN_URL ?? '',
      process.env.DATABASE_ADMIN_PASSWORD,
      process.env.DATA_TLS_CA_FILE ?? '',
    ),
  );
  await client.connect();
  return client;
}

/** Every Odisha PIN code from odisha-pins.csv, as `{ pin, district }`. */
export function odishaPins() {
  const lines = readFileSync(new URL('./odisha-pins.csv', import.meta.url), 'utf8')
    .trim()
    .split('\n');
  return lines.slice(1).map((line) => {
    const [pin, district] = line.split(',');
    return { pin, district };
  });
}

/** The PIN codes of one demo city. */
export function cityPins(city) {
  const { prefixes, extra } = CITIES[city];
  const pins = odishaPins().map((row) => row.pin);
  return [...new Set([...pins.filter((pin) => prefixes.some((p) => pin.startsWith(p))), ...extra])];
}

/**
 * Loads all of Odisha: the demo cities serviceable, every other code known but not served yet, so
 * a super admin can start serving one from the catalogue page (AD-08). Pilot codes stay as they are.
 */
export async function loadPins(client) {
  const served = new Set(Object.keys(CITIES).flatMap(cityPins));
  const rows = odishaPins();
  await client.query(
    `INSERT INTO app.pin_code (pin, district, serviceable)
       SELECT * FROM unnest($1::text[], $2::text[], $3::boolean[])
     ON CONFLICT (pin) DO UPDATE SET serviceable = app.pin_code.serviceable OR EXCLUDED.serviceable`,
    [rows.map((r) => r.pin), rows.map((r) => r.district), rows.map((r) => served.has(r.pin))],
  );
  return { total: rows.length, served: served.size };
}

/** Moves a booking and its shifts to start `minutes` from now, as e2e-support/move-booking.mjs. */
export async function moveToSoon(client, bookingId, minutes = 5) {
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
}

/**
 * Spreads a booking the seed carried out in seconds over a believable day: booked and paid the
 * evening before, started a few minutes after the slot, finished at its end (a lab when the
 * report is in, a few hours later) and rated that afternoon.
 */
export async function settle(client, bookingId) {
  const run = (sql) => client.query(sql, [bookingId]);
  const before = `starts_at - interval '20 hours'`;
  await run(`UPDATE app.booking SET created_at = created_at - interval '20 hours',
               confirmed_at = confirmed_at - interval '20 hours', accept_by = accept_by - interval '20 hours' WHERE id = $1`);
  await run(`UPDATE app.payment SET created_at = created_at - interval '20 hours',
               paid_at = paid_at - interval '20 hours' WHERE booking_id = $1`);
  await run(`UPDATE app.booking_offer SET offered_at = offered_at - interval '20 hours',
               responded_at = responded_at - interval '20 hours' WHERE booking_id = $1`);
  await run(`UPDATE app.booking_event e SET created_at = e.created_at - interval '20 hours'
               FROM app.booking b WHERE b.id = e.booking_id AND e.booking_id = $1
                AND e.to_status IN ('pending_payment', 'requested', 'confirmed') AND e.created_at > b.${before}`);
  await settleLab(run);
  const done = `(SELECT coalesce(max(r.created_at), b.ends_at + interval '2 minutes') FROM app.lab_report r WHERE r.booking_id = b.id)`;
  await run(`UPDATE app.booking b SET completed_at = ${done} WHERE id = $1`);
  await run(`UPDATE app.visit v SET started_at = b.starts_at + interval '3 minutes', completed_at = b.completed_at
               FROM app.booking b WHERE b.id = v.booking_id AND v.booking_id = $1`);
  await run(`UPDATE app.booking_event e SET created_at = CASE e.to_status
                 WHEN 'in_progress' THEN b.starts_at + interval '3 minutes' ELSE b.completed_at END
               FROM app.booking b WHERE b.id = e.booking_id AND e.booking_id = $1
                AND e.to_status IN ('in_progress', 'completed')`);
  await run(`UPDATE app.review r SET created_at = b.completed_at + interval '3 hours'
               FROM app.booking b WHERE b.id = r.booking_id AND r.booking_id = $1`);
}

/** Booked with the booking; then collection and the stages after it 90 minutes apart, the report last. */
async function settleLab(run) {
  await run(`UPDATE app.lab_event SET created_at = created_at - interval '20 hours'
              WHERE booking_id = $1 AND stage IN ('booked', 'collector_assigned')`);
  await run(`UPDATE app.lab_event e SET created_at = b.starts_at + interval '3 minutes' + (s.k - 1) * interval '90 minutes'
               FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS k FROM app.lab_event
                      WHERE booking_id = $1 AND stage NOT IN ('booked', 'collector_assigned')) s,
                    app.booking b
              WHERE s.id = e.id AND b.id = e.booking_id`);
  await run(`UPDATE app.lab_report r SET created_at = (SELECT max(created_at) FROM app.lab_event WHERE booking_id = $1)
              WHERE r.booking_id = $1`);
}

/** Tables whose rows belong to one booking, keyed by the column that names it. */
const BOOKING_TABLES = [
  ['booking', 'id'],
  ['booking_event', 'booking_id'],
  ['booking_offer', 'booking_id'],
  ['payment', 'booking_id'],
  ['refund', 'booking_id'],
  ['visit', 'booking_id'],
  ['shift', 'booking_id'],
  ['review', 'booking_id'],
  ['lab_order', 'booking_id'],
  ['lab_event', 'booking_id'],
  ['lab_report', 'booking_id'],
];

/**
 * Dates a finished booking back so it started `days` ago at `hour` o'clock in India, moving every
 * timestamp of its own rows by the same amount, so history reads like weeks of use. The audit
 * log and the ledger keep their real times: the audit trail is append-only, payouts follow the ledger.
 */
export async function backdate(client, bookingId, days, hour) {
  const { rows } = await client.query(
    `SELECT starts_at - ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
              - make_interval(days => $2) + make_interval(hours => $3)) AT TIME ZONE 'Asia/Kolkata') AS shift
       FROM app.booking WHERE id = $1`,
    [bookingId, days, hour],
  );
  const shift = rows[0].shift;
  for (const [table, key] of BOOKING_TABLES) {
    const columns = await timestampColumns(client, table);
    if (columns.length === 0) continue;
    const sets = columns.map((c) => `${c} = ${c} - $2::interval`).join(', ');
    await client.query(`UPDATE app.${table} SET ${sets} WHERE ${key} = $1`, [bookingId, shift]);
  }
}

async function timestampColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = $1 AND data_type = 'timestamp with time zone'`,
    [table],
  );
  return rows.map((row) => `"${row.column_name}"`);
}

/** True when the named demo patient already has an account: the seed runs once per database. */
export async function alreadySeeded(client) {
  const { rows } = await client.query(
    `SELECT 1 FROM app.admin_account WHERE email = 'super@demo.heach.invalid'`,
  );
  return rows.length > 0;
}
