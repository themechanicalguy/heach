const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'kumari', 'sri']);

/** Lower-case words of a name without punctuation or titles; scripts are kept as written. */
function words(name: string): string[] {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}]+/u)
    .filter((word) => word !== '' && !HONORIFICS.has(word));
}

/** A word agrees with another when they are equal or one is the other's initial. */
function agrees(a: string, b: string): boolean {
  return a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));
}

/**
 * Whether two names are the same person's name as far as spelling shows (KY-04): the same words
 * in any order, with initials and a missing middle name allowed. At least one full word must be
 * shared. Names in different scripts never match here; a person decides those.
 */
export function namesMatch(typed: string, verified: string): boolean {
  const [shorter, longer] = [words(typed), words(verified)].sort((a, b) => a.length - b.length);
  if (!shorter || !longer || shorter.length === 0) return false;
  const left = [...longer];
  for (const word of shorter) {
    const at = left.findIndex((other) => agrees(word, other));
    if (at === -1) return false;
    left.splice(at, 1);
  }
  return shorter.some((word) => word.length > 1 && longer.includes(word));
}
