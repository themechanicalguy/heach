/** Indian mobile numbers, with or without +91, wherever they appear in a string value. */
const MOBILE_PATTERN = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;

/** Trace IDs (32 hex), span IDs (16 hex) and UUIDs, matched against a whole word. */
const HEX_ID_PATTERNS = [/^(?:[\da-f]{16}){1,2}$/i, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i];
const WORD_SEPARATOR = /([^\da-z-]+)/i;

/**
 * Masks mobile numbers inside strings that redaction by key cannot see (LM-02.1). Whole hex IDs
 * are kept: random hex can hold ten digits in a row, and masking it breaks trace correlation.
 */
export function maskValue(value: string): string {
  let masked = '';
  let pending = '';
  for (const word of value.split(WORD_SEPARATOR)) {
    if (HEX_ID_PATTERNS.some((pattern) => pattern.test(word))) {
      masked += pending.replace(MOBILE_PATTERN, '[MOBILE]') + word;
      pending = '';
    } else {
      pending += word;
    }
  }
  return masked + pending.replace(MOBILE_PATTERN, '[MOBILE]');
}
