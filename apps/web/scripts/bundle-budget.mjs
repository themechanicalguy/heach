// PF-02.1: the JavaScript an entry route makes the browser download before it is interactive,
// measured gzipped. Counts <script src> (not nomodule) and script preloads in the served HTML,
// once each.
import { gzipSync } from 'node:zlib';

// `nomodule` scripts (legacy polyfills) are skipped by every browser that runs modules.
const SCRIPT_SRC = /<script(?![^>]*\snomodule)[^>]*\ssrc="([^"]+\.js[^"]*)"/gi;
const SCRIPT_PRELOAD =
  /<link[^>]*rel="(?:modulepreload|preload)"[^>]*href="([^"]+\.js[^"]*)"[^>]*>/g;

/** Unique same-origin script URLs referenced by the HTML. */
export function initialScripts(html) {
  const urls = [...html.matchAll(SCRIPT_SRC), ...html.matchAll(SCRIPT_PRELOAD)].map(
    (match) => match[1],
  );
  return [...new Set(urls)].filter((url) => url.startsWith('/'));
}

/** Sum of gzipped sizes; `load(url)` returns the file's bytes. */
export async function initialJsGzipBytes(html, load) {
  const sizes = await Promise.all(
    initialScripts(html).map(async (url) => gzipSync(await load(url)).length),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}
