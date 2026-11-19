import type { CapacitorConfig } from '@capacitor/cli';

// The server address, start path and app identity are set per build flavour in
// android/app/build.gradle and applied in MainActivity; nothing environment-specific lives here.
const config: CapacitorConfig = {
  appId: 'in.heach',
  appName: 'HEACH',
  webDir: 'www',
};

export default config;
