// Pull request check (ADR 0011, constitution gate G3): a pull request that changes apps/,
// packages/ or infra/ names a spec that is already Approved on the base branch and the criterion
// IDs it satisfies, or carries the `spec-exempt` label with a reason. It checks that links and
// IDs exist; whether the code meets them is for review.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { status } from './lib/spec-markdown.mjs';

const CODE_PATH = /^(apps|packages|infra)\//;
const STEP_SPEC = /docs\/specs\/step-\d\d-[a-z0-9-]+\.md/g;
const FEATURE_SPEC = /(?<![\w/])specs\/(\d{3}-[a-z0-9-]+)/g;
const CRITERION = /\b[A-Z][A-Z0-9]*-\d{2}\.\d+\b/g;
const APPROVED = new Set(['Approved', 'Done']);

/** Spec files a pull request body links: step specs, and each feature's spec.md and plan.md. */
export function linkedSpecs(body) {
  const steps = [...body.matchAll(STEP_SPEC)].map((match) => [match[0]]);
  const features = [...body.matchAll(FEATURE_SPEC)].map((match) => [
    `specs/${match[1]}/spec.md`,
    `specs/${match[1]}/plan.md`,
  ]);
  return [...new Map([...steps, ...features].map((files) => [files[0], files])).values()];
}

function exemptionProblems(body) {
  const reason = (line) =>
    line
      .trim()
      .replace(/^Spec exemption:/i, '')
      .trim();
  const lines = body.split('\n').filter((line) => /^Spec exemption:/i.test(line.trim()));
  return lines.some((line) => reason(line) !== '')
    ? []
    : ['Label spec-exempt needs a "Spec exemption: <reason>" line in the pull request body'];
}

function approvalProblems(files, readAtBase) {
  return files.flatMap((file) => {
    const markdown = readAtBase(file);
    if (markdown === undefined) return [`${file} is not on the base branch; merge the spec first`];
    return APPROVED.has(status(markdown) ?? '')
      ? []
      : [`${file} is ${status(markdown) ?? 'without a Status'} on the base branch, not Approved`];
  });
}

function criterionProblems(body, specs, readAtHead) {
  const ids = [...new Set(body.match(CRITERION) ?? [])];
  if (ids.length === 0)
    return ['Name the criterion IDs this pull request satisfies (for example EN-03.1)'];
  const text = specs.map((files) => readAtHead(files[0]) ?? '').join('\n');
  return ids
    .filter((id) => !new RegExp(`\\|\\s*${id.replace('.', '\\.')}\\s*\\|`).test(text))
    .map((id) => `${id} is not a criterion in the linked specs`);
}

/** Problems with one pull request. readAtBase/readAtHead return a file's text or undefined. */
export function prSpecProblems({ changed, body: rawBody, labels, readAtBase, readAtHead }) {
  if (!changed.some((file) => CODE_PATH.test(file))) return [];
  // The template's hints sit in HTML comments and contain example IDs; only written text counts.
  const body = rawBody.replace(/<!--[\s\S]*?-->/g, '');
  if (labels.includes('spec-exempt')) return exemptionProblems(body);
  const specs = linkedSpecs(body);
  if (specs.length === 0) {
    return [
      'Link the approved spec (docs/specs/step-NN-*.md or specs/NNN-*/) in the pull request body',
    ];
  }
  return [
    ...approvalProblems(specs.flat(), readAtBase),
    ...criterionProblems(body, specs, readAtHead),
  ];
}

function git(args) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- CI and developer git
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' });
}

function gitShow(ref, file) {
  try {
    return git(['show', `${ref}:${file}`]);
  } catch {
    return undefined;
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const base = process.env.BASE_SHA ?? '';
  const changed = git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .filter(Boolean);
  const problems = prSpecProblems({
    changed,
    body: process.env.PR_BODY ?? '',
    labels: JSON.parse(process.env.PR_LABELS ?? '[]'),
    readAtBase: (file) => gitShow(base, file),
    readAtHead: (file) => gitShow('HEAD', file),
  });
  if (problems.length > 0) {
    process.stderr.write(`${problems.map((problem) => '::error::' + problem).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(
    'Spec link and criterion IDs present (structure only; review decides content)\n',
  );
}
