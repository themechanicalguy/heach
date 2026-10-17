import type { AppEnv } from '../config/env.schema.js';

/** Environments where the test identity adapter may run (SE-07.4). Step 3 brings OTP login. */
export const TEST_LOGIN_ENVS: readonly AppEnv[] = ['local', 'test', 'dev'];

/** Throws at start-up when test login would be reachable outside dev and test. */
export function assertTestLoginAllowed(appEnv: AppEnv): void {
  if (!TEST_LOGIN_ENVS.includes(appEnv)) {
    throw new Error(`Test identity adapter refused in ${appEnv}`);
  }
}
