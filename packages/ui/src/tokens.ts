/**
 * Design tokens (UX-02). ui.css mirrors these as CSS custom properties and media queries; a test
 * keeps the two in step.
 */
export const breakpoints = {
  mobile: { min: 360, max: 599 },
  tablet: { min: 600, max: 1023 },
  desktop: { min: 1024 },
} as const;

/** Media queries for the larger layouts; mobile is the default (mobile first). */
export const media = {
  tablet: `(min-width: ${String(breakpoints.tablet.min)}px)`,
  desktop: `(min-width: ${String(breakpoints.desktop.min)}px)`,
} as const;

export type DeviceClass = keyof typeof breakpoints;

/** Device class for a viewport width, as used by RUM reports (LM-04). */
export function deviceClass(width: number): DeviceClass {
  if (width >= breakpoints.desktop.min) return 'desktop';
  return width >= breakpoints.tablet.min ? 'tablet' : 'mobile';
}

export const colors = {
  primary: '#1f4e79',
  onPrimary: '#ffffff',
  focus: '#f5a623',
  text: '#1a1a1a',
  muted: '#4a5560',
  surface: '#ffffff',
  background: '#f6f8fa',
  border: '#c9d1d9',
  danger: '#a61b1b',
  success: '#1b6e3a',
  warning: '#7a4b00',
} as const;

/** Minimum touch target in CSS pixels (A11Y-03). */
export const touchTarget = 48;
