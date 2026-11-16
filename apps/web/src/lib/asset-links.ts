type Env = Readonly<Record<string, string | undefined>>;

interface Statement {
  relation: string[];
  target: { namespace: 'android_app'; package_name: string; sha256_cert_fingerprints: string[] };
}

const APPS = [
  ['in.heach.patient', 'ANDROID_PATIENT_CERT_SHA256'],
  ['in.heach.provider', 'ANDROID_PROVIDER_CERT_SHA256'],
] as const;

/** A signing certificate's SHA-256 fingerprint as Android prints it: 32 hex pairs with colons. */
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fingerprints(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => FINGERPRINT.test(part));
}

/**
 * Digital Asset Links: tells Android which apps may open this site's links (MA-06). An app is
 * listed only once its signing fingerprint is configured; fingerprints are public.
 */
export function assetLinks(env: Env): Statement[] {
  return APPS.map(([packageName, variable]) => ({
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app' as const,
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints(env[variable]),
    },
  })).filter((statement) => statement.target.sha256_cert_fingerprints.length > 0);
}
