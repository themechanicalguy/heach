/**
 * Bounded single-character spelling tolerance in all UTF-8 scripts (SD-02). SQL LIKE's `_`
 * matches one character. Patterns cover one insertion, omission or substitution; query length
 * is capped at 60 by the DTO. Parameters, never SQL interpolation, carry these patterns.
 */
export function searchPatterns(query: string | undefined): string[] | null {
  if (!query) return null;
  const normalized = query
    .normalize('NFC')
    .toLowerCase()
    .replaceAll(/[%_\\]/g, '');
  const letters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(normalized),
    ({ segment }) => segment,
  );
  const variants = new Set([`%${letters.join('')}%`]);
  if (letters.length < 4) return [...variants];
  for (let index = 0; index <= letters.length; index += 1) {
    const before = letters.slice(0, index).join('');
    const after = letters.slice(index).join('');
    variants.add(`%${before}_${after}%`);
    if (index < letters.length) {
      variants.add(
        `%${before}${'_'.repeat(Array.from(letters[index] ?? '').length)}${letters.slice(index + 1).join('')}%`,
      );
      variants.add(`%${before}${letters.slice(index + 1).join('')}%`);
    }
  }
  return [...variants];
}
