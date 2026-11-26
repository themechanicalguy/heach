import { appleAppSiteAssociation } from '../../../lib/apple-app-links';

export const dynamic = 'force-dynamic';

/** iPhone reads this, without a file extension, to let the HEACH apps open this site's links (MA-06). */
export function GET(): Response {
  return Response.json(appleAppSiteAssociation(process.env));
}
