/** The part of the Android shell's bridge the web app uses (apps/mobile, ADR 0016). */
interface NativeBridge {
  nativePromise: (plugin: string, method: string, options: object) => Promise<unknown>;
}

const bridge = (): NativeBridge | undefined =>
  (globalThis as { Capacitor?: NativeBridge }).Capacitor;

/** Asks the Android app to do something only it can; rejects in a browser. */
export async function callApp(plugin: string, method: string, options: object = {}): Promise<void> {
  const app = bridge();
  if (!app) throw new Error('The app bridge is missing');
  await app.nativePromise(plugin, method, options);
}

/** For touches of polish: nothing happens in a browser, and a failure is not worth reporting. */
export function callAppQuietly(plugin: string, method: string, options: object = {}): void {
  if (!bridge()) return;
  callApp(plugin, method, options).catch(() => undefined);
}
