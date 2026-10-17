// Prints the AWS Free plan credit status and its alert level (playbook part B4).
//   node scripts/credit-status.mjs [--json] [--no-spend] [--simulate remaining=10,daysLeft=20,...]
// Simulate keys: remaining, daysLeft, status, dailySpend. Cost Explorer is billed per request
// (about $0.01), so a normal run makes exactly one Cost Explorer call; --no-spend makes none.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';
import {
  classifyLevel,
  daysBetween,
  isoDate,
  LEVELS,
  projectRunOut,
  warnings,
} from './lib/credit-level.mjs';

const SPEND_DAYS = 14;
const baseline = JSON.parse(
  readFileSync(new URL('../docs/credit-baseline.json', import.meta.url), 'utf8'),
);

function aws(args) {
  return JSON.parse(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- runs the operator's or CI's AWS CLI
    execFileSync('aws', [...args, '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

function readPlan() {
  const plan = aws(['freetier', 'get-account-plan-state', '--region', 'us-east-1']);
  return {
    type: plan.accountPlanType,
    status: plan.accountPlanStatus,
    remaining: plan.accountPlanRemainingCredits?.amount ?? 0,
    expiry: new Date(plan.accountPlanExpirationDate),
  };
}

/** Average daily usage before credits over the last SPEND_DAYS days; null while no data exists. */
function readDailySpend(today) {
  const start = new Date(today.getTime() - SPEND_DAYS * 24 * 60 * 60 * 1000);
  const filter = { Not: { Dimensions: { Key: 'RECORD_TYPE', Values: ['Credit', 'Refund'] } } };
  try {
    const result = aws([
      'ce',
      'get-cost-and-usage',
      '--region',
      'us-east-1',
      '--time-period',
      `Start=${isoDate(start)},End=${isoDate(today)}`,
      '--granularity',
      'MONTHLY',
      '--metrics',
      'UnblendedCost',
      '--filter',
      JSON.stringify(filter),
    ]);
    const total = result.ResultsByTime.reduce(
      (sum, period) => sum + Number(period.Total.UnblendedCost.Amount),
      0,
    );
    return total / SPEND_DAYS;
  } catch {
    return null; // new accounts have no Cost Explorer data for the first day or so
  }
}

function parseSimulate(text) {
  return Object.fromEntries(text.split(',').map((pair) => pair.split('=')));
}

function gather(argv, today) {
  const simulateAt = argv.indexOf('--simulate');
  if (simulateAt !== -1) {
    const fake = parseSimulate(argv[simulateAt + 1] ?? '');
    const daysLeft = Number(fake.daysLeft ?? 120);
    return {
      simulated: true,
      type: 'FREE',
      status: fake.status ?? 'ACTIVE',
      remaining: Number(fake.remaining ?? baseline.creditsGranted),
      expiry: new Date(today.getTime() + daysLeft * 24 * 60 * 60 * 1000),
      dailySpend: fake.dailySpend === undefined ? null : Number(fake.dailySpend),
    };
  }
  const plan = readPlan();
  return {
    simulated: false,
    ...plan,
    dailySpend: argv.includes('--no-spend') ? null : readDailySpend(today),
  };
}

function report(data, today) {
  const daysLeft = daysBetween(today, data.expiry);
  const percentLeft = Math.round((data.remaining / baseline.creditsGranted) * 100);
  const runOut = projectRunOut({ remaining: data.remaining, dailySpend: data.dailySpend, today });
  const level = classifyLevel({ percentLeft, daysLeft });
  return {
    simulated: data.simulated,
    planType: data.type,
    planStatus: data.status,
    remainingUsd: data.remaining,
    creditsGrantedUsd: baseline.creditsGranted,
    percentLeft,
    expiryDate: isoDate(data.expiry),
    daysLeft,
    dailySpendUsd: data.dailySpend === null ? null : Number(data.dailySpend.toFixed(2)),
    runOutDate: runOut ? isoDate(runOut) : null,
    level,
    action: LEVELS.find((entry) => entry.name === level)?.action ?? 'No action needed.',
    warnings: warnings({ status: data.status, runOut, expiry: data.expiry }),
  };
}

function spendText(dailySpend) {
  return dailySpend === null ? 'no data yet' : `$${dailySpend}`;
}

function print(result) {
  const lines = [
    `${result.simulated ? 'SIMULATED ' : ''}AWS ${result.planType} plan, status ${result.planStatus}`,
    `Credits: $${result.remainingUsd} of $${result.creditsGrantedUsd} left (${result.percentLeft}%)`,
    `Plan ends: ${result.expiryDate} (${result.daysLeft} days)`,
    `Daily usage (last ${SPEND_DAYS} days, before credits): ${spendText(result.dailySpendUsd)}`,
    `Credits run out at this rate: ${result.runOutDate ?? 'not projected'}`,
    `Level: ${result.level}. ${result.action}`,
    ...result.warnings.map((warning) => `WARNING: ${warning}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

const today = new Date();
const result = report(gather(process.argv.slice(2), today), today);
if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`);
else print(result);
