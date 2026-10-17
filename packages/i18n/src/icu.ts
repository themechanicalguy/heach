/**
 * The subset of ICU MessageFormat the catalogues use (I18N-02.2): `{name}`, `{n, plural, …}` with
 * `=N` and CLDR categories and `#`, and `{x, select, …}`. Every plural and select needs `other`.
 * `''` is a literal apostrophe. No dependency: plural categories come from Intl.PluralRules.
 */
export type MessageValues = Readonly<Record<string, string | number>>;

export class IcuSyntaxError extends Error {}

interface Cursor {
  text: string;
  pos: number;
}

export function formatIcu(pattern: string, values: MessageValues, locale: string): string {
  const cursor = { text: pattern, pos: 0 };
  const result = formatUntil(cursor, values, locale, undefined, false);
  if (cursor.pos < pattern.length) {
    throw new IcuSyntaxError(`Unexpected '}' at ${String(cursor.pos)}`);
  }
  return result;
}

/** Throws IcuSyntaxError when the pattern cannot be parsed; used by the catalogue check. */
export function assertValidIcu(pattern: string): void {
  formatIcu(pattern, new Proxy({}, { get: () => 1, has: () => true }), 'en');
}

function formatUntil(
  c: Cursor,
  values: MessageValues,
  locale: string,
  count: number | undefined,
  nested: boolean,
): string {
  let out = '';
  while (c.pos < c.text.length) {
    const char = c.text[c.pos];
    if (char === '}' && nested) return out;
    if (char === '}') throw new IcuSyntaxError(`Unexpected '}' at ${String(c.pos)}`);
    if (char === '{') {
      out += formatArgument(c, values, locale);
    } else if (char === '#' && count !== undefined) {
      out += new Intl.NumberFormat(locale).format(count);
      c.pos += 1;
    } else if (char === "'" && c.text[c.pos + 1] === "'") {
      out += "'";
      c.pos += 2;
    } else {
      out += char ?? '';
      c.pos += 1;
    }
  }
  if (nested) throw new IcuSyntaxError('Missing }');
  return out;
}

function formatArgument(c: Cursor, values: MessageValues, locale: string): string {
  c.pos += 1; // '{'
  const head = readUntil(c, /[,}]/).trim();
  if (c.text[c.pos] === '}') {
    c.pos += 1;
    return String(valueOf(values, head));
  }
  c.pos += 1; // ','
  const type = readUntil(c, /[,}]/).trim();
  if (c.text[c.pos] !== ',' || (type !== 'plural' && type !== 'select')) {
    throw new IcuSyntaxError(`Unsupported argument type '${type}' for ${head}`);
  }
  c.pos += 1;
  const options = readOptions(
    c,
    values,
    locale,
    type === 'plural' ? Number(valueOf(values, head)) : undefined,
  );
  const value = valueOf(values, head);
  const key = type === 'plural' ? pluralKey(options, Number(value), locale) : String(value);
  return options.get(key) ?? options.get('other') ?? '';
}

function readOptions(
  c: Cursor,
  values: MessageValues,
  locale: string,
  count: number | undefined,
): Map<string, string> {
  const options = new Map<string, string>();
  for (;;) {
    const key = readUntil(c, /[{}]/).trim();
    if (c.text[c.pos] === '}') {
      c.pos += 1;
      break;
    }
    if (!key) throw new IcuSyntaxError('Option without a key');
    c.pos += 1; // '{'
    options.set(key, formatUntil(c, values, locale, count, true));
    c.pos += 1; // '}'
  }
  if (!options.has('other')) throw new IcuSyntaxError('Plural or select without other');
  return options;
}

function pluralKey(options: Map<string, string>, n: number, locale: string): string {
  return options.has(`=${String(n)}`) ? `=${String(n)}` : new Intl.PluralRules(locale).select(n);
}

function readUntil(c: Cursor, stop: RegExp): string {
  const start = c.pos;
  while (c.pos < c.text.length && !stop.test(c.text[c.pos] ?? '')) c.pos += 1;
  if (c.pos >= c.text.length) throw new IcuSyntaxError('Missing }');
  return c.text.slice(start, c.pos);
}

function valueOf(values: MessageValues, name: string): string | number {
  if (!(name in values)) throw new Error(`Missing value for {${name}}`);
  return values[name] ?? '';
}
