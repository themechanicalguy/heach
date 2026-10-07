import packageJson from '../../../package.json';

export const dynamic = 'force-dynamic';

/** Liveness check. Exposes status and build version only, never config or dependency details. */
export function GET(): Response {
  // An empty BUILD_VERSION (as in .env.example) counts as unset.
  const buildVersion = process.env.BUILD_VERSION?.trim();
  const version =
    buildVersion !== undefined && buildVersion !== '' ? buildVersion : packageJson.version;
  return Response.json({ status: 'ok', version }, { headers: { 'Cache-Control': 'no-store' } });
}
