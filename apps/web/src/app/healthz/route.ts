import packageJson from '../../../package.json';

export const dynamic = 'force-dynamic';

/** Liveness check. Exposes status and build version only, never config or dependency details. */
export function GET(): Response {
  const version = process.env.BUILD_VERSION ?? packageJson.version;
  return Response.json({ status: 'ok', version }, { headers: { 'Cache-Control': 'no-store' } });
}
