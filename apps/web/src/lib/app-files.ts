import { callApp } from './app-bridge';

export interface AppFile {
  /** With its extension, as a download would be named. */
  name: string;
  contentType: string;
  contentBase64: string;
}

/**
 * Hands a file to the Android app, which opens it in the phone's viewer (MA-06). A web view
 * ignores the in-memory download links browsers use, so inside the apps this replaces them.
 */
export async function openInApp(file: AppFile): Promise<void> {
  await callApp('HeachFiles', 'open', file);
}

/** Text as base64, for a file made on the page (the account export). */
export function textAsBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
