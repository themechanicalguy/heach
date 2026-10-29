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

/**
 * Lavender and peach palette from the design reference (apps/web/design-mockups.html). Text
 * colours meet 4.5:1 on the surfaces they sit on (A11Y-03).
 */
export const colors = {
  primary: '#6b4fa3',
  primarySoft: '#efeaf8',
  onPrimary: '#ffffff',
  accent: '#ffb48f',
  accentSoft: '#ffebdd',
  onAccent: '#7a3410',
  focus: '#b0501f',
  text: '#241a38',
  muted: '#5e5473',
  surface: '#ffffff',
  background: '#f8f6fb',
  border: '#e2dcec',
  danger: '#b3261e',
  dangerSoft: '#fbe5e3',
  success: '#14602b',
  successSoft: '#d6efdd',
  warning: '#7a3410',
} as const;

/** Minimum touch target in CSS pixels (A11Y-03). */
export const touchTarget = 48;
