/** File types and limits every upload shares (EN-07, PO-02, MV-16). */
export const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadPurpose =
  'provider_document' | 'booking_attachment' | 'visit_record' | 'lab_report' | 'vault_upload';

// The first bytes of each allowed type: the declared type alone is never trusted.
const SIGNATURES: Record<UploadType, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
};

export type UploadProblem = 'upload_type' | 'upload_size' | 'upload_mismatch';

/** Why this file is refused before scanning, if it is. */
export function uploadProblem(contentType: string, bytes: Buffer): UploadProblem | undefined {
  if (!(UPLOAD_TYPES as readonly string[]).includes(contentType)) return 'upload_type';
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return 'upload_size';
  const signature = SIGNATURES[contentType as UploadType];
  return signature.every((byte, index) => bytes[index] === byte) ? undefined : 'upload_mismatch';
}
