// HTTP helpers for the demo seed: the API as each synthetic person would call it from their phone.
import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const API = process.env.DEMO_API_ORIGIN ?? `http://localhost:${process.env.API_PORT ?? '3001'}`;
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';
export const UPLOAD = 'application/vnd.heach.upload+json';

/**
 * Each synthetic person gets their own documentation-range address (RFC 5737), as separate
 * phones would have, so the per-address OTP caps (SE-08) apply per person and not to the seed.
 */
export function addressFor(mobile) {
  const n = Number(mobile.slice(-3));
  return `198.51.${String(100 + Math.floor(n / 250))}.${String(n % 250)}`;
}

/** One API call; throws with the status and the stable reason code only, never the body. */
export async function call(path, init = {}) {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const headers = {
    ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    ...(init.address ? { 'x-forwarded-for': init.address } : {}),
    ...(init.body === undefined ? {} : { 'content-type': init.contentType ?? 'application/json' }),
  };
  const response = await globalThis.fetch(`${API}${path}`, {
    method,
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    const { code } = await response.json().catch(() => ({}));
    throw new Error(`${method} ${path} answered ${String(response.status)} ${code ?? ''}`);
  }
  return response.status === 204 ? undefined : response.json();
}

async function inbox(mobile) {
  const query = encodeURIComponent(`to:"91${mobile}@sms.heach.local"`);
  const list = await (await globalThis.fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json();
  return list.messages.map((message) => message.ID);
}

/** Runs `send`, then waits for the six-digit code in the new SMS to this number (local Mailpit). */
export async function withCode(mobile, send) {
  const before = await inbox(mobile);
  const result = await send();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const fresh = (await inbox(mobile)).find((id) => !before.includes(id));
    if (fresh) {
      const message = await (await globalThis.fetch(`${MAILPIT}/api/v1/message/${fresh}`)).json();
      const code = /\d{6}/.exec(message.Text)?.[0];
      if (code) return { result, code };
    }
    await sleep(250);
  }
  throw new Error('No SMS arrived in Mailpit');
}

/** Signs a person in by OTP; returns a session the other helpers pass around. */
export async function signIn(mobile) {
  const address = addressFor(mobile);
  const { result, code } = await withCode(mobile, () =>
    call('/v1/auth/otp', { address, body: { mobile, locale: 'en' } }),
  );
  const { accessToken } = await call('/v1/auth/otp/verify', {
    address,
    body: { challengeId: result.challengeId, code, locale: 'en' },
  });
  return { mobile, address, token: accessToken, at: Date.now() };
}

const USER_RENEW_MS = 12 * 60_000; // tokens live 15 minutes (SE-07.1)

/** Signs the person in again when their token is close to expiry; the session is updated in place. */
async function fresh(session) {
  if (Date.now() - session.at < USER_RENEW_MS) return session;
  Object.assign(session, await signIn(session.mobile));
  return session;
}

/** The fresh second check some provider steps need (SE-02). */
export async function reverify(session) {
  const { result, code } = await withCode(session.mobile, () =>
    call('/v1/auth/reverify', { token: session.token, address: session.address, body: {} }),
  );
  await call('/v1/auth/reverify/verify', {
    token: session.token,
    address: session.address,
    body: { challengeId: result.challengeId, code },
  });
}

/** Sends a call as this person. */
export async function as(session, path, init = {}) {
  await fresh(session);
  return call(path, { ...init, token: session.token, address: session.address });
}

/** Finishes account setup with the consents the API asks for; returns the new session. */
export async function completeSetup(session, details) {
  await as(session, '/v1/me/setup', { method: 'PUT', body: { adultDeclared: true, ...details } });
  const { consentsDue } = await as(session, '/v1/me');
  const { accessToken } = await as(session, '/v1/me/setup/complete', {
    body: { consents: consentsDue },
  });
  return Object.assign(session, { token: accessToken, at: Date.now() });
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 6238 code for a base32 secret, as an authenticator app would show it. */
export function totp(secret, step = Math.floor(Date.now() / 30_000)) {
  const bits = Array.from(secret, (c) => BASE32.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const ADMIN_RENEW_MS = 8 * 60_000; // admin tokens live 10 minutes (AD-01)
const step = () => Math.floor(Date.now() / 30_000);

/** First sign-in of a CLI-made admin: password, then TOTP enrolment. */
export async function enrolAdmin(email, password) {
  const { mfaTicket, enrolment } = await call('/admin/v1/auth/password', {
    body: { email, password },
  });
  const usedStep = step();
  const { accessToken } = await call('/admin/v1/auth/mfa', {
    body: { mfaTicket, code: totp(enrolment.secret, usedStep) },
  });
  return {
    email,
    password,
    secret: enrolment.secret,
    token: accessToken,
    at: Date.now(),
    usedStep,
  };
}

/** Signs the admin in again near expiry, waiting for a TOTP step not used yet (codes are single use). */
async function freshAdmin(admin) {
  if (Date.now() - admin.at < ADMIN_RENEW_MS) return admin;
  while (step() <= admin.usedStep) await sleep(1000);
  const { mfaTicket } = await call('/admin/v1/auth/password', {
    body: { email: admin.email, password: admin.password },
  });
  admin.usedStep = step();
  const { accessToken } = await call('/admin/v1/auth/mfa', {
    body: { mfaTicket, code: totp(admin.secret, admin.usedStep) },
  });
  return Object.assign(admin, { token: accessToken, at: Date.now() });
}

/** Sends a call as this admin. */
export async function asAdmin(admin, path, init = {}) {
  await freshAdmin(admin);
  return call(path, { ...init, token: admin.token });
}
