/** A URL as telemetry may keep it: no query string, no fragment (LM-03.1, MV-11). */
export function withoutQueryOrFragment(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

const ID = /^[0-9a-f-]{8,}$/i;
// Random tokens mix case or digits; lowercase route slugs such as service names never do.
const TOKEN = /^(?=.*[\dA-Z])[\w-]{20,}$/;

/** `/or/notes` becomes `/[locale]/notes`: a route template, never a URL with IDs or tokens. */
export function routeTemplate(pathname: string): string {
  const rest = withoutQueryOrFragment(pathname).split('/').slice(2).filter(Boolean);
  const masked = rest.map((part) => {
    if (ID.test(part)) return '[id]';
    return TOKEN.test(part) ? '[token]' : part;
  });
  return ['/[locale]', ...masked].join('/');
}
