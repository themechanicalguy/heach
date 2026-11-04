/** Normalize keyboard-entered Odia and Devanagari numerals without changing other text. */
export function normalizeDigits(input: string): string {
  return input.replace(/[०-९୦-୯]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x0b66 ? 0x0b66 : 0x0966));
  });
}
