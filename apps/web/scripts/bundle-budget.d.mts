export function initialScripts(html: string): string[];
export function initialJsGzipBytes(
  html: string,
  load: (url: string) => Promise<Buffer>,
): Promise<number>;
