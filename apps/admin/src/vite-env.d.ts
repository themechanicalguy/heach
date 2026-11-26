/// <reference types="vite/client" />

/** Build-time settings the console reads; both are public once built into the page. */
interface ImportMetaEnv {
  /** GlitchTip DSN for front-end errors (LM-03); error tracking is off without it. */
  readonly VITE_GLITCHTIP_DSN?: string;
  /** Release tag on each error, matching the uploaded source maps (LM-03.1). */
  readonly VITE_BUILD_VERSION?: string;
}
