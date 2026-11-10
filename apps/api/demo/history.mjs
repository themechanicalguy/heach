// The booking history the demo opens with: finished and rated visits weeks back, a lab report,
// a cancellation with its refund, confirmed bookings ahead and one request waiting to be accepted.
import { REVIEWS } from './data.mjs';
import { accept, bookAndPay, cancel, finishedVisit } from './bookings.mjs';

const PHYSIO_NOTES = {
  procedure: 'Knee strengthening and mobility exercises, 40 minutes',
  observations: 'Range of motion better than last session; mild pain on full bend',
  advice: 'Home exercises twice a day; ice after walking',
};
const NURSE_NOTES = {
  procedure: 'Wound cleaned and dressed with sterile gauze',
  observations: 'Healing well, no discharge or redness',
  advice: 'Keep the dressing dry; next change in three days',
};

const marketOf = (team, role, city) =>
  team.market.filter((p) => p.person.role === role && p.person.city === city);

/** Ananya: her own physio course, her mother's dressing, a lab report and what lies ahead. */
async function ananya(db, patient, { named, market }) {
  const { physio, nurse, lab, attendant } = named;
  const visit = (provider, item, extra = {}) => ({
    provider,
    item,
    listingId: provider.listings[item],
    ...extra,
  });
  await finishedVisit(db, patient, physio.session, visit(physio, 'physio_ortho_rehab'), {
    notes: PHYSIO_NOTES,
    review: REVIEWS[0],
    daysAgo: 24,
  });
  await finishedVisit(db, patient, physio.session, visit(physio, 'physio_ortho_rehab'), {
    notes: PHYSIO_NOTES,
    review: REVIEWS[3],
    daysAgo: 17,
  });
  await finishedVisit(
    db,
    patient,
    nurse.session,
    visit(nurse, 'nursing_wound_dressing', {
      recipientId: patient.motherId,
      notes: 'Diabetic, dressing on the left foot',
    }),
    { notes: NURSE_NOTES, review: REVIEWS[1], daysAgo: 12 },
  );
  const extras = [lab.listings.lab_lipid_profile, lab.listings.lab_hba1c];
  await finishedVisit(
    db,
    patient,
    lab.session,
    visit(lab, 'lab_cbc', { collection: 'walk_in', extraListingIds: extras }),
    { lab: true, review: REVIEWS[2], daysAgo: 6 },
  );

  const other = market.find(
    (p) => p.person.role === 'physiotherapist' && p.person.city === 'bhubaneswar',
  );
  const cancelled = await bookAndPay(patient, visit(other, 'physio_assessment', { daysAhead: 2 }));
  await accept(other.session, cancelled);
  await cancel(patient, cancelled, 'changed_plans');

  const shifts = await bookAndPay(
    patient,
    visit(attendant, 'attendant_day_12h', {
      daysAhead: 3,
      hour: 8,
      shiftDays: 3,
      recipientId: patient.motherId,
      notes: 'Needs help walking and with meals',
    }),
  );
  await accept(attendant.session, shifts);
  const injection = await bookAndPay(
    patient,
    visit(nurse, 'nursing_injection', { daysAhead: 1, hour: 9, recipientId: patient.motherId }),
  );
  await accept(nurse.session, injection);
  // Left waiting: the demo physio accepts it live from the provider app within the window.
  await bookAndPay(
    patient,
    visit(physio, 'physio_geriatric', { daysAhead: 2, hour: 11, recipientId: patient.motherId }),
  );
}

/** Other patients rate other providers, so search shows a spread of ratings. */
async function others(db, people, team) {
  const pairs = [
    [
      people.patientCuttack,
      marketOf(team, 'physiotherapist', 'cuttack')[0],
      'physio_post_operative',
      REVIEWS[4],
      20,
    ],
    [
      people.patientCuttack,
      marketOf(team, 'nurse', 'cuttack')[0],
      'nursing_iv_fluids',
      REVIEWS[5],
      9,
    ],
    [
      people.patientPatia,
      marketOf(team, 'physiotherapist', 'bhubaneswar')[1],
      'physio_neuro_rehab',
      REVIEWS[4],
      15,
    ],
    [
      people.patientPatia,
      marketOf(team, 'nurse', 'bhubaneswar')[0],
      'nursing_vitals_check',
      REVIEWS[3],
      5,
    ],
  ];
  for (const [patient, provider, item, review, daysAgo] of pairs) {
    const notes = item.startsWith('physio') ? PHYSIO_NOTES : NURSE_NOTES;
    await finishedVisit(
      db,
      patient,
      provider.session,
      { provider, item, listingId: provider.listings[item] },
      { notes, review, daysAgo },
    );
  }
  const cuttackLab = marketOf(team, 'lab', 'cuttack')[0];
  const labTest = await bookAndPay(people.patientCuttack, {
    provider: cuttackLab,
    item: 'lab_thyroid_profile',
    listingId: cuttackLab.listings.lab_thyroid_profile,
    daysAhead: 2,
    hour: 8,
  });
  await accept(cuttackLab.session, labTest);
}

export async function seedHistory(db, people, team, log) {
  await ananya(db, people.patient, team);
  log('  Ananya: 4 finished, 1 cancelled, 2 confirmed, 1 waiting');
  await others(db, people, team);
  log('  Rakesh and Itishree: 4 finished and rated, 1 lab test confirmed');
}
