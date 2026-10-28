import { pino } from 'pino';
import { maskValue } from './mask.js';

/**
 * Words that mark a key as holding personal or health data (LM-02). A key matches when any of its
 * words is listed, so `phoneNumber`, `patient_name` and `X-Auth-Token` all match. This is a
 * safety net, not a licence: never pass Restricted data to the logger.
 */
const PERSONAL_WORDS = new Set([
  'name',
  'mobile',
  'phone',
  'email',
  'address',
  'aadhaar',
  'dob',
  'otp',
  'password',
  'token',
  'authorization',
  'cookie',
  // Restricted health fields (LM-02.1).
  'body',
  'note',
  'notes',
  'diagnosis',
  'prescription',
]);

/** Values deeper than this (the logged object is depth 0) are not inspected (LM-02.6). */
const MAX_DEPTH = 8;

/** A whole number written as an Indian mobile number, with or without 91 in front. */
const MOBILE_NUMBER = /^(?:91)?[6-9]\d{9}$/;

/** Splits a key into lower-case words at lower-to-upper case changes, digits, `_`, `-`, `.` and spaces. */
export function isPersonalKey(key: string): boolean {
  return key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1 ')
    .toLowerCase()
    .split(/[\s_.-]+/)
    .some((word) => PERSONAL_WORDS.has(word));
}

function isBinary(value: object): boolean {
  return Buffer.isBuffer(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function sanitizePrimitive(value: unknown): unknown {
  if (typeof value === 'string') return maskValue(value);
  if ((typeof value === 'number' && Number.isInteger(value)) || typeof value === 'bigint') {
    return MOBILE_NUMBER.test(String(value).replace(/^-/, '')) ? '[MOBILE]' : value;
  }
  return value;
}

function sanitizeObject(object: object, depth: number, path: Set<object>): unknown {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(object)) {
    if (isPersonalKey(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    try {
      result[key] = walk((object as Record<string, unknown>)[key], depth + 1, path);
    } catch {
      result[key] = '[UNREADABLE]';
    }
  }
  return result;
}

function walk(value: unknown, depth: number, path: Set<object>): unknown {
  if (depth > MAX_DEPTH) return '[DEPTH]';
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return sanitizePrimitive(value);
  }
  if (isBinary(value)) return '[BINARY]';
  if (path.has(value)) return '[CIRCULAR]';
  path.add(value);
  try {
    if (value instanceof Error) return walk(pino.stdSerializers.err(value), depth, path);
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1, path));
    return sanitizeObject(value, depth, path);
  } finally {
    // Path, not "seen": a value referenced twice without a cycle is written in both places.
    path.delete(value);
  }
}

/**
 * Returns a copy of `value` with personal keys redacted and mobile numbers masked at every depth,
 * errors serialized and masked, and placeholders where a value cannot be inspected safely
 * (LM-02.3 to LM-02.6). Never changes the input and never throws (LM-02.8).
 */
export function sanitizeLogValue(value: unknown): unknown {
  try {
    return walk(value, 0, new Set());
  } catch {
    return '[UNREADABLE]';
  }
}
