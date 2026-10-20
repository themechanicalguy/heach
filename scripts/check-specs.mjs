// Structural checks on specs (SO-01.1, ADR 0007, ADR 0011): every step spec and feature plan has
// a threat model; feature specs and plans have their required sections; criterion IDs build on
// known requirement IDs and are defined once; the specs index lists every spec. These checks
// prove structure only, never that a spec is right or approved.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  criterionIds,
  requirementIds,
  requirementOf,
  section,
  status,
  tableRows,
} from './lib/spec-markdown.mjs';

const SPEC_SECTIONS = [
  [2, 'Scope'],
  [2, 'User Scenarios & Testing'],
  [3, 'Edge Cases and failures'],
  [3, 'Functional Requirements'],
  [3, 'Permissions'],
  [3, 'Key Entities and data classification'],
  [3, 'Audit and consent'],
  [2, 'Screens, languages and accessibility'],
  [2, 'Success Criteria'],
  [2, 'Open questions'],
];
const PLAN_SECTIONS = [
  [2, 'Constitution Check'],
  [2, 'Data model and migrations'],
  [2, 'Encryption and keys'],
  [2, 'API contracts'],
  [2, 'Threat model'],
  [2, 'Rollout'],
  [2, 'Verification'],
];
const STATUSES = new Set(['Draft', 'Approved', 'Done']);

const withoutComments = (markdown) => markdown.replace(/<!--[\s\S]*?-->/g, '');
const filled = (row) => row.split('|').some((cell) => cell.trim() !== '');

/** Problems with a spec's threat model: missing section, or a table with no threats (SO-01.1). */
export function specProblems(name, markdown) {
  const body = section(markdown, 2, 'Threat model');
  if (body === undefined) return [`${name}: no "## Threat model" section (SO-01.1)`];
  return tableRows(body).some(filled) ? [] : [`${name}: threat model has no threats (SO-01.1)`];
}

function missingSections(name, markdown, required) {
  return required
    .filter(([level, title]) => section(markdown, level, title) === undefined)
    .map(([level, title]) => `${name}: no "${'#'.repeat(level)} ${title}" section`);
}

function unknownRequirements(name, ids, knownRequirements) {
  return ids
    .filter((id) => !knownRequirements.has(requirementOf(id)))
    .map(
      (id) =>
        `${name}: ${id} does not build on a requirement ID in the requirements or a step spec`,
    );
}

function approvalProblems(name, spec, plan) {
  const problems = [];
  if (plan === undefined) problems.push(`${name}: Approved without plan.md`);
  if (/\[NEEDS CLARIFICATION/.test(withoutComments(spec + (plan ?? '')))) {
    problems.push(`${name}: Approved with an open [NEEDS CLARIFICATION]`);
  }
  const questions = tableRows(section(spec, 2, 'Open questions')).filter(filled);
  if (questions.length > 0) problems.push(`${name}: Approved with open questions`);
  if (/\*\*Approval\*\*:\s*\[/.test(spec))
    problems.push(`${name}: Approved without an Approval line`);
  return problems;
}

/** Problems in one feature directory: spec.md and, when present, plan.md. */
export function featureProblems(name, spec, plan, knownRequirements) {
  const specStatus = status(spec);
  const ids = criterionIds(section(spec, 3, 'Functional Requirements'));
  const problems = [
    ...(STATUSES.has(specStatus) ? [] : [`${name}: Status must be Draft, Approved or Done`]),
    ...(/\*\*Step\*\*:.*docs\/specs\/step-\d\d-/.test(spec) ? [] : [`${name}: no **Step** link`]),
    ...missingSections(`${name}/spec.md`, spec, SPEC_SECTIONS),
    ...(ids.length > 0 ? [] : [`${name}: no criterion IDs under Functional Requirements`]),
    ...unknownRequirements(name, ids, knownRequirements),
  ];
  if (plan !== undefined) {
    problems.push(...missingSections(`${name}/plan.md`, plan, PLAN_SECTIONS));
    problems.push(...specProblems(`${name}/plan.md`, plan));
  }
  if (specStatus === 'Approved' || specStatus === 'Done') {
    problems.push(...approvalProblems(name, spec, plan));
  }
  return problems;
}

/** Criterion IDs defined in more than one place. `defined` maps a file name to its IDs. */
export function duplicateProblems(defined) {
  const owners = new Map();
  for (const [name, ids] of Object.entries(defined)) {
    for (const id of ids) owners.set(id, [...(owners.get(id) ?? []), name]);
  }
  return [...owners]
    .filter(([, names]) => names.length > 1)
    .map(([id, names]) => `${id} is defined more than once: ${names.join(', ')}`);
}

/** Specs the index does not link. */
export function indexProblems(rawReadme, stepFiles, featureDirs) {
  const readme = withoutComments(rawReadme);
  const missing = [
    ...stepFiles.filter((file) => !readme.includes(`(${file})`)),
    ...featureDirs.filter((dir) => !readme.includes(`specs/${dir}/`)),
  ];
  return missing.map((name) => `docs/specs/README.md does not list ${name}`);
}

function readIfPresent(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

function stepCriteria(markdown) {
  return criterionIds(section(markdown, 2, 'Acceptance criteria'));
}

function allProblems() {
  const stepFiles = readdirSync('docs/specs').filter((name) => /^step-.*\.md$/.test(name));
  const steps = Object.fromEntries(
    stepFiles.map((name) => [name, readFileSync(join('docs/specs', name), 'utf8')]),
  );
  const featureDirs = existsSync('specs')
    ? readdirSync('specs', { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join('specs', entry.name, 'spec.md')))
        .map((entry) => entry.name)
    : [];
  const stepIds = Object.values(steps).flatMap(stepCriteria);
  const known = new Set([
    ...requirementIds(readFileSync('docs/mvp-v1-requirements.md', 'utf8')),
    ...stepIds.map(requirementOf),
  ]);
  const defined = Object.fromEntries(Object.entries(steps).map(([n, md]) => [n, stepCriteria(md)]));
  const problems = Object.entries(steps).flatMap(([name, md]) => specProblems(name, md));
  for (const dir of featureDirs) {
    const spec = readFileSync(join('specs', dir, 'spec.md'), 'utf8');
    const plan = readIfPresent(join('specs', dir, 'plan.md'));
    problems.push(...featureProblems(`specs/${dir}`, spec, plan, known));
    defined[`specs/${dir}`] = criterionIds(section(spec, 3, 'Functional Requirements'));
  }
  const readme = readFileSync('docs/specs/README.md', 'utf8');
  return [
    ...problems,
    ...duplicateProblems(defined),
    ...indexProblems(readme, stepFiles, featureDirs),
  ];
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const problems = allProblems();
  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(
    'Specs are structurally complete (structure only; review decides content)\n',
  );
}
