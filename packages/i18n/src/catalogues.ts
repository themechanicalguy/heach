import { assertValidIcu, IcuSyntaxError } from './icu.js';
import type { Locale } from './locales.js';
import type { MessageTree } from './translator.js';

export interface CatalogueProblem {
  locale: Locale;
  key: string;
  problem: 'missing' | 'extra' | 'invalid ICU' | 'arguments differ';
}

function leaves(tree: MessageTree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of leaves(value, `${path}.`)) out.set(k, v);
  }
  return out;
}

function argumentNames(pattern: string): string {
  const names = new Set([...pattern.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1] ?? ''));
  return [...names].sort((a, b) => a.localeCompare(b)).join(',');
}

/**
 * Every locale must have exactly the reference locale's keys, valid ICU, and the same arguments
 * (I18N-07.1). The first locale given is the reference.
 */
export function findCatalogueProblems(
  catalogues: Readonly<Partial<Record<Locale, MessageTree>>>,
): CatalogueProblem[] {
  const entries = Object.entries(catalogues) as [Locale, MessageTree][];
  const [reference] = entries;
  if (!reference) return [];
  const referenceLeaves = leaves(reference[1]);
  return entries.flatMap(([locale, tree]) => {
    const own = leaves(tree);
    const problems: CatalogueProblem[] = [];
    for (const [key, pattern] of referenceLeaves) {
      const translated = own.get(key);
      if (translated === undefined) problems.push({ locale, key, problem: 'missing' });
      else if (!isValid(translated)) problems.push({ locale, key, problem: 'invalid ICU' });
      else if (argumentNames(translated) !== argumentNames(pattern))
        problems.push({ locale, key, problem: 'arguments differ' });
    }
    for (const key of own.keys()) {
      if (!referenceLeaves.has(key)) problems.push({ locale, key, problem: 'extra' });
    }
    return problems;
  });
}

function isValid(pattern: string): boolean {
  try {
    assertValidIcu(pattern);
    return true;
  } catch (error) {
    if (error instanceof IcuSyntaxError) return false;
    throw error;
  }
}
