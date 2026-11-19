import { openInApp, textAsBase64 } from './app-files';

const FILE = { name: 'report.pdf', contentType: 'application/pdf', contentBase64: 'JVBERg==' };

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
});

it('hands the file to the app shell (MA-06)', async () => {
  const nativePromise = vi.fn().mockResolvedValue(undefined);
  (window as { Capacitor?: unknown }).Capacitor = { nativePromise };
  await openInApp(FILE);
  expect(nativePromise).toHaveBeenCalledWith('HeachFiles', 'open', FILE);
});

it('fails when there is no app shell, so the caller can say so', async () => {
  await expect(openInApp(FILE)).rejects.toThrow();
});

it('encodes text in any script as base64', () => {
  const decoded = new TextDecoder().decode(
    Uint8Array.from(atob(textAsBase64('ଓଡ଼ିଆ {"a":1}')), (character) => character.charCodeAt(0)),
  );
  expect(decoded).toBe('ଓଡ଼ିଆ {"a":1}');
});
