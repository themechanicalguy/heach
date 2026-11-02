/** Line icons drawn on a 24 px grid, after the design reference; stroke follows the text colour. */
const PATHS = {
  physiotherapy: [
    'M12 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
    'M5 9h14',
    'M12 7v7',
    'm12 14-5 7',
    'm12 14 5 7',
  ],
  nurse: ['M5 7h14v13H5z', 'M9 7V4h6v3', 'M12 11v6', 'M9 14h6'],
  attendant: [
    'M3 6v15',
    'M3 17h18v4',
    'M3 13h5v4',
    'M8 11h9a4 4 0 0 1 4 4v2',
    'M5 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  ],
  lab: ['M9 3h6', 'M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3', 'M7 15h10'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9v11h14V9', 'M10 20v-6h4v6'],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'],
  note: [
    'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z',
    'M14 3v5h5',
    'M9 13h6M9 17h4',
  ],
  user: ['M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M4 21a8 8 0 0 1 16 0'],
  globe: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
    'M3 12h18',
    'M12 3c3 3.5 3 14.5 0 18c-3-3.5-3-14.5 0-18',
  ],
  'chevron-down': ['m6 9 6 6 6-6'],
  'log-in': ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  check: ['m5 12 5 5 9-10'],
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  /** Width and height in pixels; 20 by default. */
  size?: number;
}

/** Decorative only: hidden from assistive technology, so the text beside it carries the meaning. */
export function Icon({ name, size = 20 }: Readonly<IconProps>) {
  return (
    <svg
      className="heach-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
