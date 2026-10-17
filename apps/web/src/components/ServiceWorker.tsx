'use client';

import { useEffect } from 'react';

/** Registers the shell service worker in production builds (PF-07). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
  }, []);
  return null;
}
