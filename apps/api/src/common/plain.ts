/** A DTO's shape as a plain object type, so it can be spread without losing a class prototype. */
export type Plain<T> = { [K in keyof T]: T[K] };
