/** Injection tokens for the shared connections. One pool and one client per process. */
export const PG_POOL = Symbol('PG_POOL');
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
