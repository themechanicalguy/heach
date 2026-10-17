# @heach/flags

Server-side feature flags (FF-01): `new FeatureFlags(appEnv, process.env.FEATURE_FLAGS)`. A flag
is on only when listed for the environment and allowed there by `FLAG_DEFINITIONS`; unset means
off. Used by the API and the web server; never read flags in the browser.
