import { MAX_UPLOAD_BYTES, uploadProblem } from './upload-rules.js';

const pdf = Buffer.from('%PDF-1.7 synthetic');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('Upload rules (EN-07)', () => {
  it('EN-07 accepts PDF, JPEG and PNG whose bytes match the declared type', () => {
    expect(uploadProblem('application/pdf', pdf)).toBeUndefined();
    expect(uploadProblem('image/png', png)).toBeUndefined();
    expect(uploadProblem('image/jpeg', jpeg)).toBeUndefined();
  });

  it('EN-07 refuses other types, empty or oversized files, and mismatched bytes', () => {
    expect(uploadProblem('text/html', pdf)).toBe('upload_type');
    expect(uploadProblem('application/pdf', Buffer.alloc(0))).toBe('upload_size');
    expect(uploadProblem('application/pdf', Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toBe(
      'upload_size',
    );
    expect(uploadProblem('image/png', pdf)).toBe('upload_mismatch');
  });
});
