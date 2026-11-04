import type { Application } from '@heach/types';
import { describe, expect, it } from 'vitest';
import { doneCount, documentsUploaded, nextTask, taskState, tasksFor } from './tasks';

type Document = NonNullable<Application['items'][number]['document']>;
const file = (over: Partial<Document> = {}): Document => ({
  id: 'd1',
  scanStatus: 'clean',
  reference: null,
  expiresOn: null,
  reviewStatus: 'pending',
  reviewReason: null,
  uploadedAt: '2026-10-30T00:00:00Z',
  ...over,
});
const app = (over: Partial<Application> = {}): Application => ({
  role: 'nurse',
  status: 'draft',
  statusReason: null,
  identity: 'not_started',
  needsPayout: true,
  payout: null,
  editable: true,
  missing: [],
  items: [
    {
      key: 'qualification_certificate',
      required: true,
      reference: false,
      expiry: false,
      document: null,
    },
    { key: 'reference_letter', required: false, reference: false, expiry: false, document: null },
  ],
  ...over,
});
const withFile = (document: Document) =>
  app({
    items: [
      {
        key: 'qualification_certificate',
        required: true,
        reference: false,
        expiry: false,
        document,
      },
    ],
  });

describe('G06 onboarding task states come from the application, not the screen', () => {
  it('lists payout only for roles that are paid', () => {
    expect(tasksFor(app())).toEqual(['identity', 'documents', 'payout', 'review']);
    expect(tasksFor(app({ needsPayout: false }))).toEqual(['identity', 'documents', 'review']);
  });

  it.each([
    ['not_started', 'todo'],
    ['pending', 'review'],
    ['verified', 'done'],
    ['failed', 'attention'],
  ] as const)('identity %s is %s', (identity, state) => {
    expect(taskState(app({ identity }), 'identity')).toBe(state);
  });

  it('documents: a missing required file is to do; optional ones do not count', () => {
    expect(taskState(app(), 'documents')).toBe('todo');
    expect(documentsUploaded(app())).toEqual({ done: 0, total: 1 });
    expect(taskState(withFile(file()), 'documents')).toBe('done');
  });

  it('documents: a refused or rejected file needs attention; waiting files are in review once submitted', () => {
    expect(taskState(withFile(file({ scanStatus: 'infected' })), 'documents')).toBe('attention');
    expect(taskState(withFile(file({ reviewStatus: 'rejected' })), 'documents')).toBe('attention');
    const submitted = { ...withFile(file()), status: 'under_review' as const };
    expect(taskState(submitted, 'documents')).toBe('review');
  });

  it.each([
    ['draft', 'todo'],
    ['submitted', 'review'],
    ['under_review', 'review'],
    ['changes_requested', 'attention'],
    ['approved', 'done'],
  ] as const)('submission while %s is %s', (status, state) => {
    expect(taskState(app({ status }), 'review')).toBe(state);
  });

  it('counts only done tasks and picks the first one the provider can act on', () => {
    const partly = app({
      identity: 'pending',
      payout: { method: 'upi', holderName: 'Synthetic', hint: '1234' },
    });
    expect(doneCount(partly)).toBe(1);
    expect(nextTask(partly)).toBe('documents');
    expect(nextTask({ ...withFile(file()), identity: 'verified', needsPayout: false })).toBe(
      'review',
    );
  });
});
