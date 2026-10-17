import { AsyncLocalStorage } from 'node:async_hooks';

export type Role = 'patient' | 'provider' | 'admin';
export const ROLES: readonly Role[] = ['patient', 'provider', 'admin'];

export interface Principal {
  userId: string;
  role: Role;
  sessionId: string;
}

/** Per-request values that logs, audit entries and queries pick up (LM-01, SE-05). */
export interface RequestContext {
  correlationId: string;
  principal?: Principal;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
