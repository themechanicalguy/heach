import { useEffect, useState } from 'react';

/** Whole seconds left until a code may be sent again; `restart` begins a new wait. */
export function useCountdown(initial = 0): { seconds: number; restart: (seconds: number) => void } {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => {
      setSeconds((current) => current - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [seconds]);
  return { seconds, restart: setSeconds };
}
