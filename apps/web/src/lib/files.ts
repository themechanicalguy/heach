import { ApiError, UPLOAD_CONTENT_TYPE } from './api';

/** The API's limit (EN-07): checked here first so a large file fails at once, not after upload. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * A chosen file as base64, for the upload content type (EN-07). Nothing is kept on the device.
 * A file over the limit is refused as the API would refuse it (`errors.upload_size`).
 */
export function readAsBase64(file: Blob): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) return Promise.reject(new ApiError(413, 'upload_size'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('File could not be read'));
    };
    reader.readAsDataURL(file);
  });
}

/** Request options that send a file and its details to an upload route. */
export async function uploadInit(
  file: File,
  extra: Record<string, unknown> = {},
): Promise<RequestInit> {
  const body = { contentType: file.type, contentBase64: await readAsBase64(file), ...extra };
  return {
    method: 'PUT',
    headers: { 'content-type': UPLOAD_CONTENT_TYPE },
    body: JSON.stringify(body),
  };
}
