import type { Application } from '@heach/types';

export type Task = 'identity' | 'documents' | 'payout' | 'review';
/** Where a task stands: done, waiting on HEACH, needing the provider's attention, or still to do. */
export type TaskState = 'done' | 'review' | 'attention' | 'todo';

const REVIEWING = new Set<Application['status']>(['submitted', 'under_review']);

export function tasksFor(application: Application): Task[] {
  return application.needsPayout
    ? ['identity', 'documents', 'payout', 'review']
    : ['identity', 'documents', 'review'];
}

function identityState(application: Application): TaskState {
  if (application.identity === 'verified') return 'done';
  if (application.identity === 'failed') return 'attention';
  return application.identity === 'pending' ? 'review' : 'todo';
}

function documentsState(application: Application): TaskState {
  const files = application.items.map((item) => item.document);
  if (files.some((file) => file?.scanStatus === 'infected' || file?.reviewStatus === 'rejected'))
    return 'attention';
  if (application.items.some((item) => item.required && !item.document)) return 'todo';
  const waiting = files.some((file) => file?.reviewStatus === 'pending');
  return REVIEWING.has(application.status) && waiting ? 'review' : 'done';
}

function submitState(application: Application): TaskState {
  if (application.status === 'changes_requested') return 'attention';
  if (REVIEWING.has(application.status)) return 'review';
  return application.status === 'draft' ? 'todo' : 'done';
}

/** Completion comes from the application itself, never from which step is on screen (G06). */
export function taskState(application: Application, task: Task): TaskState {
  if (task === 'identity') return identityState(application);
  if (task === 'documents') return documentsState(application);
  if (task === 'payout') return application.payout ? 'done' : 'todo';
  return submitState(application);
}

/** The first task the provider can act on now, in order. */
export function nextTask(application: Application): Task | undefined {
  return tasksFor(application).find((task) => {
    const state = taskState(application, task);
    return state === 'todo' || state === 'attention';
  });
}

export function doneCount(application: Application): number {
  return tasksFor(application).filter((task) => taskState(application, task) === 'done').length;
}

/** Required documents with a file, out of all required documents. */
export function documentsUploaded(application: Application) {
  const required = application.items.filter((item) => item.required);
  return { done: required.filter((item) => item.document).length, total: required.length };
}
