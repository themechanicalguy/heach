import { vi } from 'vitest';

export const blobUrls = {
  create: vi.fn<(blob: Blob | MediaSource) => string>(() => 'blob:http://localhost/synthetic-file'),
  revoke: vi.fn<(url: string) => void>(),
};

/** jsdom lacks object URLs. Keep URL parsing intact and restore after React cleanup. */
export function mockBlobUrls() {
  blobUrls.create.mockClear();
  blobUrls.revoke.mockClear();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override readonly createObjectURL = blobUrls.create;
      static override readonly revokeObjectURL = blobUrls.revoke;
    },
  );
}
