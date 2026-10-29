import { UPLOAD_CONTENT_TYPE } from './api';

/** A chosen file as base64, for the upload content type (EN-07). Nothing is kept on the device. */
export function readAsBase64(file: Blob): Promise<string> {
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
