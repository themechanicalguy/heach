'use client';

import { useSyncExternalStore } from 'react';
import { type AppAudience, appAudience } from './app-audience';

const subscribe = () => () => undefined;

/** The app this page runs in; undefined in a browser and in the server HTML. */
export function useAppAudience(): AppAudience | undefined {
  return useSyncExternalStore(
    subscribe,
    () => appAudience(navigator.userAgent),
    () => undefined,
  );
}
