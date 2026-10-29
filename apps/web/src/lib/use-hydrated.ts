'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False in the server HTML and until React has taken over the page. Forms whose action needs
 * JavaScript keep their button disabled until then, so an early tap on a slow phone does not
 * reload the page and lose what was typed.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
