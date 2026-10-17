import type { Request } from 'express';

/** Reads one cookie without a parser dependency. Values are opaque tokens, never decoded. */
export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.header('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return undefined;
}
