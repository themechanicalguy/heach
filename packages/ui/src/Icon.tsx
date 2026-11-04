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
  calendar: [
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
    'M8 3v4M16 3v4M3 10h18',
  ],
  shield: ['M12 3 20 6v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z', 'M12 8v5M12 16v.5'],
  wallet: ['M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11', 'M16 13h2'],
  lock: [
    'M7 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2',
    'M8 10V7a4 4 0 0 1 8 0v3',
  ],
  message: ['M4 5h16v11H9l-5 4z'],
  phone: [
    'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2',
  ],
  mail: [
    'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
    'm3.5 6.5 8.5 6.5 8.5-6.5',
  ],
  image: [
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    'M8 10a1.5 1.5 0 1 0 0-3a1.5 1.5 0 1 0 0 3',
    'm21 16-5-5-9 9',
  ],
  bell: ['M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15z', 'M10 21h4'],
  search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'm20 20-4-4'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  'chevron-left': ['m15 6-6 6 6 6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  plus: ['M12 5v14', 'M5 12h14'],
  upload: ['M12 15V4', 'm7 9 5-5 5 5', 'M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'],
  share: [
    'M5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
    'M14 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
    'M14 18a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
    'm9.7 10.8 4.6-2.6',
    'm9.7 13.2 4.6 2.6',
  ],
  clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7v5l3 2'],
  pill: ['M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z', 'm7 7 7 7'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'm13 7 4 4'],
  users: [
    'M5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
    'M2 20a6.5 6.5 0 0 1 13 0',
    'M15.5 4.6a3.5 3.5 0 0 1 0 6.8',
    'M17.5 14a6.5 6.5 0 0 1 4.5 6',
  ],
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
