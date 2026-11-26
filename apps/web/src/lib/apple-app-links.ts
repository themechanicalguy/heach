import { APP_IDS, type Env } from './asset-links';

/** Apple's team ID: ten capital letters or digits, public (it is part of every signed app). */
const TEAM_ID = /^[A-Z0-9]{10}$/;

/** The provider area, with or without a locale prefix; the provider app's links on Android too. */
const PROVIDER_PATHS = ['/provider', '/provider/*', '/*/provider', '/*/provider/*'];

interface Component {
  '/': string;
  exclude?: true;
}

interface AppleAppSiteAssociation {
  applinks: { details: { appIDs: string[]; components: Component[] }[] };
}

/**
 * Tells iPhone which apps may open this site's links (MA-06), as `assetlinks.json` does for
 * Android: the provider app the provider area, the patient app everything else, so the phone
 * never asks which to use. Empty until the team that signs the apps is configured.
 */
export function appleAppSiteAssociation(env: Env): AppleAppSiteAssociation {
  const team = env.APPLE_TEAM_ID?.trim() ?? '';
  if (!TEAM_ID.test(team)) return { applinks: { details: [] } };
  return {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${APP_IDS.provider}`],
          components: PROVIDER_PATHS.map((path) => ({ '/': path })),
        },
        {
          appIDs: [`${team}.${APP_IDS.patient}`],
          components: [
            ...PROVIDER_PATHS.map((path) => ({ '/': path, exclude: true as const })),
            { '/': '*' },
          ],
        },
      ],
    },
  };
}
