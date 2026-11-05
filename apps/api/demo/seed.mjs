// Demo seed (local and test only): a lived-in HEACH built through the real API. Admins, approved
// providers across six Odisha cities, applications waiting for review, patients with a family
// member and a booking history in every state. Synthetic people only (docs/demo-data.md).
// Usage: pnpm demo:seed (the API, Postgres, Redis and Mailpit must be running: pnpm dev:up).
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import { as, completeSetup, enrolAdmin, signIn } from './client.mjs';
import { LINKED_MOTHER, NAMED, WAITING, marketProviders } from './data.mjs';
import { alreadySeeded, connect, loadPins, refuseOutsideLocal } from './db.mjs';
import { apply, approve, goLive } from './providers.mjs';
import { seedHistory } from './history.mjs';

const CREDENTIALS = new URL('../../../.demo-credentials.json', import.meta.url);
const ADMIN_ROLES = ['super_admin', 'verifier', 'support', 'finance'];
const log = (line) => process.stdout.write(`${line}\n`);

/** Admins through the operator CLI (password on standard input), then their first sign-in. */
async function createAdmins() {
  const admins = {};
  for (const role of ADMIN_ROLES) {
    const email = `${role.split('_')[0]}@demo.heach.invalid`;
    const password = randomBytes(18).toString('base64url');
    execFileSync(
      process.execPath,
      [
        '--env-file-if-exists=../../.env',
        'dist/jobs/create-admin.js',
        '--email',
        email,
        '--role',
        role,
      ],
      { input: password, stdio: ['pipe', 'ignore', 'inherit'] },
    );
    admins[role] = await enrolAdmin(email, password);
  }
  return admins;
}

/** One provider from sign-up to live listings; `approved: false` leaves it in the queue. */
async function provider(person, verifier, approved = true) {
  const session = await apply(person);
  if (!approved) return { person, session };
  const accountId = await approve(verifier, person.name);
  const listings = await goLive(session, person);
  return { person, session, accountId, listings };
}

async function providers(verifier) {
  const named = {};
  for (const key of ['physio', 'nurse', 'attendant', 'lab']) {
    named[key] = await provider({ ...NAMED[key], city: 'bhubaneswar', feeFactor: 1 }, verifier);
    log(`  provider ${named[key].person.name} (${key}) live`);
  }
  const market = [];
  for (const person of marketProviders()) {
    market.push(await provider(person, verifier));
    log(`  provider ${person.name} (${person.role}, ${person.city}) live`);
  }
  for (const person of WAITING) await provider(person, verifier, false);
  log(`  ${String(WAITING.length)} applications waiting for review`);
  return { named, market };
}

const HOUSES = {
  patient: 'Plot 214, Lane 3',
  patientCuttack: 'House 18, Sector 6',
  patientPatia: 'Flat 4B, Sai Residency',
};

async function patients() {
  const out = {};
  for (const key of Object.keys(HOUSES)) {
    const person = NAMED[key];
    const session = await signIn(person.mobile);
    await completeSetup(session, {
      role: 'patient',
      fullName: person.name,
      gender: person.gender,
      languages: ['or', 'en'],
    });
    await as(session, '/v1/me/care-pin', { method: 'PUT', body: { pin: person.pin } });
    out[key] = Object.assign(session, { pin: person.pin, house: HOUSES[key] });
  }
  const mother = await as(out.patient, '/v1/me/linked-patients', { body: LINKED_MOTHER });
  out.patient.motherId = mother.id;
  return out;
}

function saveCredentials(admins) {
  const rows = Object.entries(admins).map(([role, a]) => ({
    role,
    email: a.email,
    password: a.password,
    totpSecret: a.secret,
  }));
  writeFileSync(CREDENTIALS, `${JSON.stringify({ admins: rows }, null, 2)}\n`, { mode: 0o600 });
}

async function main() {
  refuseOutsideLocal();
  const db = await connect();
  try {
    if (await alreadySeeded(db)) {
      log(
        'Already seeded. To start again: pnpm services:reset && pnpm dev:up, then pnpm demo:seed',
      );
      return;
    }
    const pins = await loadPins(db);
    log(`PIN codes: ${String(pins.total)} Odisha codes loaded, ${String(pins.served)} served`);
    const admins = await createAdmins();
    saveCredentials(admins);
    log('Admins created and enrolled');
    const team = await providers(admins.verifier);
    const people = await patients();
    log('Patients ready');
    await seedHistory(db, people, team, log);
    log('Done. Admin sign-in details: .demo-credentials.json (git-ignored). See docs/demo-data.md');
  } finally {
    await db.end();
  }
}

await main();
