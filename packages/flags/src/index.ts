/** Deployment environments (APP_ENV), separate from NODE_ENV. */
export const APP_ENVS = ['local', 'test', 'dev', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Every flag, and the environments where it may ever be switched on. */
export const FLAG_DEFINITIONS = {
  /** The Step 2 sample entity; never outside dev and test, removed in Step 3. */
  'sample-patient-note': ['local', 'test', 'dev'],
  /** OTP sign-in, account setup and admin sign-in; off outside dev until the Step 3 exit. */
  accounts: ['local', 'test', 'dev'],
} as const satisfies Record<string, readonly AppEnv[]>;

export type FlagName = keyof typeof FLAG_DEFINITIONS;

/**
 * Server-side flags (FF-01.1), shared by the API and the web server. A flag is on only when listed in FEATURE_FLAGS for this
 * environment and allowed there; unset or unknown means off.
 */
export class FeatureFlags {
  private readonly enabled: ReadonlySet<string>;

  constructor(
    private readonly appEnv: AppEnv,
    featureFlags: string | undefined,
  ) {
    this.enabled = new Set((featureFlags ?? '').split(',').map((flag) => flag.trim()));
  }

  isOn(flag: FlagName): boolean {
    const allowed: readonly AppEnv[] = FLAG_DEFINITIONS[flag];
    return this.enabled.has(flag) && allowed.includes(this.appEnv);
  }
}
