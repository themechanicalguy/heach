import { ApiError } from './api';
import { MAX_UPLOAD_BYTES, readAsBase64 } from './files';

it('EN-07 refuses a file over the API limit before reading or sending it', async () => {
  const big = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]);
  await expect(readAsBase64(big)).rejects.toEqual(new ApiError(413, 'upload_size'));
});

it('EN-07 reads a file within the limit as base64', async () => {
  expect(await readAsBase64(new Blob(['%PDF']))).toBe('JVBERg==');
});
