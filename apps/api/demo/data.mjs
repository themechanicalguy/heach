// Demo dataset (local and test only). Every person here is synthetic: names are common Odia given
// names and surnames put together at random, numbers sit in the unused 90000 series and addresses
// are made up. Public reference data only: PIN codes from the India Post directory
// (odisha-pins.csv) and fees inside the ranges published for Bhubaneswar (docs/demo-data.md).

/** Cities the demo serves. Their PIN codes are marked serviceable; the rest of Odisha is loaded off. */
export const CITIES = {
  bhubaneswar: { prefixes: ['7510'], extra: [] },
  cuttack: { prefixes: ['7530'], extra: [] },
  puri: { prefixes: [], extra: ['752001', '752002', '752003'] },
  berhampur: { prefixes: ['76000', '76001'], extra: [] },
  sambalpur: { prefixes: ['76800'], extra: [] },
  rourkela: { prefixes: ['76900', '76901'], extra: [] },
};

/** Localities used in synthetic addresses, by PIN. */
export const LOCALITIES = {
  751002: 'Old Town, Bhubaneswar',
  751007: 'Saheed Nagar, Bhubaneswar',
  751012: 'Nayapalli, Bhubaneswar',
  751013: 'Jaydev Vihar, Bhubaneswar',
  751016: 'Chandrasekharpur, Bhubaneswar',
  751024: 'Patia, Bhubaneswar',
  751030: 'Khandagiri, Bhubaneswar',
  753001: 'Buxi Bazar, Cuttack',
  753012: 'CDA Sector 6, Cuttack',
  753014: 'Bidanasi, Cuttack',
  752001: 'Grand Road, Puri',
  760001: 'Gandhi Nagar, Berhampur',
  768001: 'Golebazar, Sambalpur',
  769001: 'Civil Township, Rourkela',
};

/** Typical fee in rupees for each catalogue item; each provider charges within ±15 % of it. */
export const BASE_FEES = {
  physio_assessment: 700,
  physio_ortho_rehab: 900,
  physio_post_operative: 1100,
  physio_neuro_rehab: 1200,
  physio_geriatric: 800,
  nursing_injection: 300,
  nursing_vitals_check: 350,
  nursing_wound_dressing: 600,
  nursing_catheter_care: 800,
  nursing_iv_fluids: 1000,
  attendant_day_12h: 800,
  attendant_night_12h: 900,
  attendant_24h: 1400,
  lab_cbc: 350,
  lab_blood_sugar_fasting: 100,
  lab_lipid_profile: 550,
  lab_thyroid_profile: 600,
  lab_hba1c: 500,
  lab_urine_routine: 180,
};

const ITEMS = {
  physiotherapist: [
    'physio_assessment',
    'physio_ortho_rehab',
    'physio_post_operative',
    'physio_neuro_rehab',
    'physio_geriatric',
  ],
  nurse: [
    'nursing_injection',
    'nursing_vitals_check',
    'nursing_wound_dressing',
    'nursing_catheter_care',
    'nursing_iv_fluids',
  ],
  attendant: ['attendant_day_12h', 'attendant_night_12h', 'attendant_24h'],
  lab: [
    'lab_cbc',
    'lab_blood_sugar_fasting',
    'lab_lipid_profile',
    'lab_thyroid_profile',
    'lab_hba1c',
    'lab_urine_routine',
  ],
};

export const itemsFor = (role) => ITEMS[role];

const FEMALE = [
  'Sasmita',
  'Pragyan',
  'Subhashree',
  'Lipsa',
  'Smruti',
  'Jyotirmayee',
  'Bandana',
  'Mamata',
  'Itishree',
  'Rashmita',
  'Puja',
  'Sarojini',
  'Ankita',
  'Madhusmita',
];
const MALE = [
  'Debasish',
  'Satyajit',
  'Prasanta',
  'Manas',
  'Biswajit',
  'Soumya Ranjan',
  'Ashutosh',
  'Bikash',
  'Chinmay',
  'Jagannath',
  'Sudhir',
  'Pradeep',
];
const SURNAMES = [
  'Mohanty',
  'Panda',
  'Das',
  'Sahoo',
  'Behera',
  'Mishra',
  'Pradhan',
  'Nayak',
  'Rout',
  'Swain',
  'Jena',
  'Patnaik',
  'Senapati',
  'Tripathy',
  'Samal',
  'Mohapatra',
];

/** A deterministic synthetic name, so a reseed gives the same people. */
export function personName(index, gender) {
  const given = gender === 'female' ? FEMALE : MALE;
  return `${given[index % given.length]} ${SURNAMES[(index * 7 + 3) % SURNAMES.length]}`;
}

const LAB_NAMES = [
  'Ekamra Demo Diagnostics',
  'Mahanadi Demo Path Lab',
  'Chilika Demo Labs',
  'Konark Demo Diagnostics',
  'Hirakud Demo Path Lab',
  'Brahmani Demo Diagnostics',
];

/** How many ordinary providers each city gets, per role (the named demo ones come on top). */
const SPREAD = {
  bhubaneswar: { physiotherapist: 4, nurse: 4, attendant: 3, lab: 2 },
  cuttack: { physiotherapist: 2, nurse: 2, attendant: 2, lab: 1 },
  puri: { physiotherapist: 1, nurse: 1, attendant: 1, lab: 0 },
  berhampur: { physiotherapist: 1, nurse: 1, attendant: 1, lab: 1 },
  sambalpur: { physiotherapist: 1, nurse: 1, attendant: 0, lab: 1 },
  rourkela: { physiotherapist: 1, nurse: 1, attendant: 1, lab: 1 },
};

/** The fixed accounts a person signs in with; the rest of the providers fill the market. */
export const NAMED = {
  patient: { mobile: '9000000101', name: 'Ananya Mohapatra', gender: 'female', pin: '751007' },
  patientCuttack: { mobile: '9000000102', name: 'Rakesh Sahoo', gender: 'male', pin: '753012' },
  patientPatia: { mobile: '9000000103', name: 'Itishree Nayak', gender: 'female', pin: '751024' },
  physio: {
    mobile: '9000000201',
    role: 'physiotherapist',
    name: 'Sasmita Pradhan',
    gender: 'female',
  },
  nurse: { mobile: '9000000202', role: 'nurse', name: 'Mamata Behera', gender: 'female' },
  attendant: { mobile: '9000000203', role: 'attendant', name: 'Jagannath Rout', gender: 'male' },
  lab: {
    mobile: '9000000204',
    role: 'lab',
    name: 'Prasanta Mishra',
    gender: 'male',
    organisation: 'Ekamra Demo Diagnostics',
  },
};

/** Applications left waiting in the admin verification queue, for the approval demo. */
export const WAITING = [
  {
    mobile: '9000000301',
    role: 'physiotherapist',
    name: 'Smruti Swain',
    gender: 'female',
    city: 'bhubaneswar',
  },
  { mobile: '9000000302', role: 'nurse', name: 'Bikash Jena', gender: 'male', city: 'cuttack' },
  {
    mobile: '9000000303',
    role: 'attendant',
    name: 'Bandana Samal',
    gender: 'female',
    city: 'puri',
  },
];

export const LINKED_MOTHER = {
  fullName: 'Sabitri Mohapatra',
  birthYear: 1954,
  gender: 'female',
  relationship: 'parent',
};

/** The ordinary providers, generated from SPREAD with numbers from 9000000401. */
export function marketProviders() {
  const used = new Set([...Object.values(NAMED), ...WAITING].map((p) => p.name));
  const out = [];
  let index = 0;
  for (const [city, roles] of Object.entries(SPREAD)) {
    for (const [role, count] of Object.entries(roles)) {
      for (let n = 0; n < count; n += 1, index += 1)
        out.push(marketProvider(index, city, role, used));
    }
  }
  return out;
}

/** The first synthetic name from `seed` on that no one else has. */
function uniqueName(seed, gender, used) {
  let n = seed;
  while (used.has(personName(n, gender))) n += 1;
  const name = personName(n, gender);
  used.add(name);
  return name;
}

function marketProvider(index, city, role, used) {
  const gender = role === 'nurse' || index % 3 !== 0 ? 'female' : 'male';
  return {
    mobile: `90000004${String(index).padStart(2, '0')}`,
    role,
    city,
    gender,
    name: uniqueName(index + 5, gender, used),
    ...(role === 'lab' ? { organisation: LAB_NAMES[(index % (LAB_NAMES.length - 1)) + 1] } : {}),
    feeFactor: 0.85 + ((index * 37) % 31) / 100,
    languages: index % 4 === 0 ? ['or', 'hi', 'en'] : ['or', 'en'],
  };
}

/** The provider's fee for an item, in paise, rounded to ten rupees. */
export function feePaise(item, factor = 1) {
  return Math.round((BASE_FEES[item] * factor) / 10) * 10 * 100;
}

export const REVIEWS = [
  {
    stars: 5,
    comment: 'Very patient and explained every exercise clearly. Knee feels much better.',
  },
  { stars: 4, comment: 'On time and gentle with my mother. Dressing done neatly.' },
  { stars: 5, comment: 'Quick sample collection and the report came the same evening.' },
  { stars: 4, comment: 'Good session, would book again.' },
  { stars: 5, comment: 'Professional and kind. Highly recommended.' },
  { stars: 3, comment: 'Service was fine but arrived a little late.' },
];
