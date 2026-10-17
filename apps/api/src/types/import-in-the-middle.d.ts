// The package ships register-hooks.d.ts next to register-hooks.mjs without an exports map, so
// TypeScript cannot pair them. Same signatures as that file (import-in-the-middle 3.5.2).
declare module 'import-in-the-middle/register-hooks.mjs' {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }
  export function register(options?: RegisterHooksOptions): void;
  export function supportsSyncHooks(): boolean;
}
