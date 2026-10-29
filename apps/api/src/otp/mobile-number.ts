/**
 * Indian mobile numbers only (decision L-6, SMS pumping to premium numbers): ten digits starting
 * 6 to 9, optionally written with +91, 91 or 0 and spaces or dashes. Returns E.164 or undefined.
 */
export function normaliseIndianMobile(input: string): string | undefined {
  const compact = input.replace(/[\s().-]/g, '');
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1] ?? ''}` : undefined;
}

/** Last four digits only, for screens and admin lists (DC: masked Confidential data). */
export function maskMobile(e164: string): string {
  return `••••••${e164.slice(-4)}`;
}
