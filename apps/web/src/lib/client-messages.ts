import { messagesFor, type Locale, type Messages } from '@heach/i18n';

type Namespace = keyof Messages;
const BOOKING: Namespace[] = [
  'profile',
  'search',
  'setup',
  'book',
  'bookings',
  'visit',
  'safety',
  'tickets',
  'lab',
  'vault',
  'sharedPanel',
  'plans',
  'referral',
  'reverify',
];
const ROUTES: Record<string, Namespace[]> = {
  home: ['search', 'bookings'],
  'sign-in': ['signIn', 'auth'],
  setup: ['setup', 'roles', 'genders', 'invitations', 'reverify'],
  consent: ['setup'],
  account: [
    'account',
    'setup',
    'pages',
    'tickets',
    'safety',
    'access',
    'roles',
    'profile',
    'genders',
    'mobileChange',
    'dataRights',
    'reverify',
    'invitations',
  ],
  people: ['people', 'genders', 'setup', 'profile'],
  team: ['team', 'roles', 'signIn', 'reverify'],
  book: BOOKING,
  bookings: BOOKING,
  plans: ['plans', 'reverify', 'book', 'people', 'referral'],
  referral: ['referral'],
  notifications: ['notifications'],
  vault: ['vault', 'sharedPanel', 'sharedLink', 'visit', 'reverify', 'signIn'],
  shared: ['vault', 'sharedLink'],
  services: ['search', 'book'],
  providers: ['search', 'book', 'profile', 'roles'],
  provider: ['application', 'roles', 'setup', 'staff', 'reverify', 'signIn'],
  'provider/onboarding': ['application'],
  'provider/services': ['providerServices', 'weekdays'],
  'provider/requests': ['requests', ...BOOKING],
  'provider/bookings': ['work', 'requests', ...BOOKING],
  'provider/lab': ['work', ...BOOKING],
  'provider/collections': ['work', ...BOOKING],
  'provider/earnings': ['earnings'],
  pages: ['pages'],
  areas: ['pages', 'search'],
  notes: ['sample', 'auth'],
  welcome: [],
};
const SITE_CLIENT_KEYS = [
  'services',
  'find',
  'forMe',
  'more',
  'profile',
  'near',
  'next',
  'details',
  'verified',
  'servesPin',
  'from',
  'pricePending',
  'checkCoverage',
  'coverageServed',
  'coverageUnserved',
  'bookingSummary',
  'clearPrices',
  'maxFee',
  'rating',
  'earliest',
] as const;

/** Only shell-island copy crosses the layout boundary; legal and marketing prose stay server-side. */
export function shellMessages(locale: Locale) {
  const catalogue = messagesFor(locale);
  return {
    ...pickNamespaces(catalogue, [
      'app',
      'nav',
      'offline',
      'state',
      'locale',
      'errors',
      'guard',
      'services',
    ]),
    site: Object.fromEntries(SITE_CLIENT_KEYS.map((key) => [key, catalogue.site[key]])),
    signIn: { codeLabel: catalogue.signIn.codeLabel, mobileHint: catalogue.signIn.mobileHint },
    people: { title: catalogue.people.title },
    vault: { person: catalogue.vault.person },
  };
}

/** Each server page adds only its client islands' domains, including on client navigation. */
export function clientMessages(locale: Locale, page = 'home') {
  const catalogue = messagesFor(locale);
  return pickNamespaces(catalogue, ROUTES[page] ?? []);
}

function pickNamespaces(catalogue: Messages, names: Namespace[]) {
  return Object.fromEntries(names.map((name) => [name, catalogue[name]]));
}
