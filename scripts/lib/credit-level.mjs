// Credit alert levels from docs/credit-expiry-plan.md (Alert levels): a level is reached when either
// trigger (percent of credits left or days left) is met, whichever comes first.

export const LEVELS = [
  {
    name: 'Emergency',
    percentLeft: 5,
    daysLeft: 7,
    action: 'Upgrade today (part B6); stop idle dev resources.',
  },
  {
    name: 'Act',
    percentLeft: 10,
    daysLeft: 15,
    action: 'Upgrade now (part B6). This is the latest safe moment.',
  },
  {
    name: 'Plan',
    percentLeft: 25,
    daysLeft: 30,
    action:
      'Confirm the payment card; take an encrypted backup outside the account; check the B6 budgets plan.',
  },
  {
    name: 'Watch',
    percentLeft: 50,
    daysLeft: 60,
    action: 'Review spend with scripts/credit-status; put the upgrade date in your calendar.',
  },
];

export const LEVEL_ORDER = ['ok', 'Watch', 'Plan', 'Act', 'Emergency'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` until `to` (negative once `to` has passed). */
export function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** The highest level whose percent or days trigger is met, or 'ok'. */
export function classifyLevel({ percentLeft, daysLeft }) {
  const reached = LEVELS.find(
    (level) => percentLeft <= level.percentLeft || daysLeft <= level.daysLeft,
  );
  return reached ? reached.name : 'ok';
}

/** Date the credits run out at the current daily spend, or null when spend is unknown or zero. */
export function projectRunOut({ remaining, dailySpend, today }) {
  if (!dailySpend || dailySpend <= 0) return null;
  return new Date(today.getTime() + Math.floor(remaining / dailySpend) * DAY_MS);
}

/** Warnings that run alongside the levels: plan state and burn rate. */
export function warnings({ status, runOut, expiry }) {
  const found = [];
  if (status !== 'ACTIVE')
    found.push(`Plan status is ${status}, not ACTIVE: check the Billing console now.`);
  if (runOut && runOut < expiry) {
    found.push(
      `Burn rate: credits run out on ${isoDate(runOut)}, before the plan ends on ${isoDate(expiry)}.`,
    );
  }
  return found;
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** True when `level` is more severe than `previous`. */
export function isHigher(level, previous) {
  return LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(previous ?? 'ok');
}
