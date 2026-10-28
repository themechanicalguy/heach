const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * First letter of each word, the rest hidden: admin lists show masked personal data (AD-01, DC).
 * Letters are grapheme clusters, so an Odia or Devanagari consonant keeps its vowel sign.
 */
export function maskName(name: string | null): string | null {
  if (!name) return null;
  return name
    .trim()
    .split(/\s+/u)
    .map((word) => {
      const letters = Array.from(graphemes.segment(word), (part) => part.segment);
      return (letters[0] ?? '') + '•'.repeat(Math.max(letters.length - 1, 1));
    })
    .join(' ');
}
