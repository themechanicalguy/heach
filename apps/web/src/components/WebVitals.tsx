'use client';

import { deviceClass } from '@heach/ui';
import { useEffect } from 'react';
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

/** `/or/notes` becomes `/[locale]/notes`: a route template, never a URL with IDs. */
export function routeTemplate(pathname: string): string {
  const rest = pathname.split('/').slice(2).filter(Boolean);
  return ['/[locale]', ...rest.map((part) => (/^[0-9a-f-]{8,}$/i.test(part) ? '[id]' : part))].join(
    '/',
  );
}

/**
 * Real-user Core Web Vitals per route and device class (LM-04.1), with no identity. web-vitals
 * reports each metric once per page load, when it is final.
 */
export function WebVitals() {
  useEffect(() => {
    const report = (metric: Metric) => {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        route: routeTemplate(window.location.pathname),
        device: deviceClass(window.innerWidth),
      });
      navigator.sendBeacon('/api/v1/rum', new Blob([body], { type: 'application/json' }));
    };
    for (const listen of [onCLS, onFCP, onINP, onLCP, onTTFB]) listen(report);
  }, []);
  return null;
}
