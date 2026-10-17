import { type AppEnv, APP_ENVS, FeatureFlags } from '@heach/flags';

/** Server-side only: reads APP_ENV and FEATURE_FLAGS of the web server process (FF-01.1). */
export function serverFlags(): FeatureFlags {
  const env = process.env.APP_ENV;
  const appEnv: AppEnv = (APP_ENVS as readonly string[]).includes(env ?? '')
    ? (env as AppEnv)
    : 'production';
  return new FeatureFlags(appEnv, process.env.FEATURE_FLAGS);
}
