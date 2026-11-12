import { readAsBase64 } from './files.js';

describe('readAsBase64', () => {
  it('EN-07 returns the file content as base64 without the data URL prefix', async () => {
    const file = new File(['%PDF synthetic'], 'synthetic.pdf', { type: 'application/pdf' });
    expect(await readAsBase64(file)).toBe(btoa('%PDF synthetic'));
  });

  it('EN-07 returns an empty string for an empty file', async () => {
    expect(await readAsBase64(new Blob([]))).toBe('');
  });
});
