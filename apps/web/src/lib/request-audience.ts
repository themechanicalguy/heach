import { headers } from 'next/headers';
import { type AppAudience, appAudience } from './app-audience';

/** The Android app that asked for this page, if any (server components only). */
export async function requestAudience(): Promise<AppAudience | undefined> {
  return appAudience((await headers()).get('user-agent'));
}
