import { assetLinks } from '../../../lib/asset-links';

export const dynamic = 'force-dynamic';

/** Android reads this to verify that the HEACH apps may open this site's links (MA-06). */
export function GET(): Response {
  return Response.json(assetLinks(process.env));
}
