import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { readCookie } from '../common/cookies.js';
import type { AccessTokenDto } from './auth.dto.js';
import type { SessionRealm } from './session-realm.js';
import type { IssuedTokens } from './session.service.js';

/** Refresh token only in a Secure, HttpOnly, SameSite=Strict cookie (SE-07.1). */
export function sendTokens(
  response: Response,
  realm: SessionRealm,
  tokens: IssuedTokens,
): AccessTokenDto {
  response.cookie(realm.cookieName, tokens.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: realm.cookiePath,
    expires: tokens.refreshExpiresAt,
  });
  response.setHeader('Cache-Control', 'no-store');
  return { accessToken: tokens.accessToken, expiresIn: realm.accessTtlSeconds };
}

export function clearRefreshCookie(response: Response, realm: SessionRealm): void {
  response.clearCookie(realm.cookieName, { path: realm.cookiePath });
}

const DEVICE_COOKIE = 'heach_device';
const DEVICE_COOKIE_PATH = '/api/v1/auth';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * A random ID per browser, used only to cap OTP requests per device (SE-08). It identifies no
 * person and is never logged; a request without one gets a new one.
 */
export function deviceId(request: Request, response: Response): string {
  const existing = readCookie(request, DEVICE_COOKIE);
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  response.cookie(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: DEVICE_COOKIE_PATH,
    expires: new Date(Date.now() + YEAR_MS),
  });
  return id;
}
