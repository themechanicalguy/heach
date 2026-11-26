import { readAsBase64 } from '@heach/ui';
import { UPLOAD_CONTENT_TYPE } from './api';

/** Request options that send a file and its details to an upload route (same shape as the web app). */
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
