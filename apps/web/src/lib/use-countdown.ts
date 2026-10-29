'use client';

import { useEffect, useState } from 'react';

/** Seconds left until `until` (a timestamp), ticking once a second. */
export function useCountdown(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [until, now]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
