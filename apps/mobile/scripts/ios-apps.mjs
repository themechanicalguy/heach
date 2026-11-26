// Builds the patient and provider iOS apps for the simulator and installs both on the booted one
// (ADR 0016). Usage: node scripts/ios-apps.mjs [patient|provider ...]
// HEACH_SERVER_URL and HEACH_ALLOW_NAVIGATION in the environment are passed on to the build.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const AUDIENCES = ['patient', 'provider'];
const ios = fileURLToPath(new URL('../ios/', import.meta.url));
const derivedData = `${ios}DerivedData`;

/** The xcodebuild arguments for one app's debug build. */
export function buildArguments(audience, env) {
  const passed = ['HEACH_SERVER_URL', 'HEACH_ALLOW_NAVIGATION']
    .filter((name) => env[name])
    .map((name) => `${name}=${env[name]}`);
  return [
    '-project',
    `${ios}App/App.xcodeproj`,
    '-scheme',
    'App',
    '-configuration',
    'Debug',
    '-destination',
    'generic/platform=iOS Simulator',
    '-derivedDataPath',
    derivedData,
    '-quiet',
    `HEACH_AUDIENCE=${audience}`,
    ...passed,
    'build',
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const asked = process.argv.slice(2);
  const audiences = asked.length > 0 ? asked.filter((name) => AUDIENCES.includes(name)) : AUDIENCES;
  for (const audience of audiences) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- Xcode's own tools
    execFileSync('xcodebuild', buildArguments(audience, process.env), { stdio: 'inherit' });
    const app = `${derivedData}/Build/Products/Debug-iphonesimulator/App.app`;
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- Xcode's own tools
    execFileSync('xcrun', ['simctl', 'install', 'booted', app], { stdio: 'inherit' });
  }
}
