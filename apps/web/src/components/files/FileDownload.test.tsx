import { cleanup, render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from '../../../../../packages/ui/src/test/axe';
import { blobUrls, mockBlobUrls } from '../../test/blob-urls';
import { FileDownload } from './FileDownload';

beforeEach(mockBlobUrls);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('EN-11 creates an opaque download URL and revokes it when leaving the record', async () => {
  const view = render(
    <FileDownload
      file={{ contentType: 'application/pdf', contentBase64: 'JVBERg==' }}
      name="synthetic"
      label="Synthetic download"
    />,
  );
  const link = await screen.findByRole('link', { name: 'Synthetic download' });
  expect(link.getAttribute('href')).toBe('blob:http://localhost/synthetic-file');
  expect(link.getAttribute('href')).not.toContain('JVBERg==');
  expect(blobUrls.create.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
  expect((blobUrls.create.mock.calls[0]?.[0] as Blob).size).toBe(4);
  expect((blobUrls.create.mock.calls[0]?.[0] as Blob).type).toBe('application/pdf');
  await expectNoAxeViolations(view.container);
  view.unmount();
  expect(blobUrls.revoke).toHaveBeenCalledExactlyOnceWith('blob:http://localhost/synthetic-file');
});

it('names the download after the file’s real type: an image is never saved as .pdf', async () => {
  render(
    <FileDownload
      file={{ contentType: 'image/png', contentBase64: 'iVBORw==' }}
      name="Synthetic scan"
      label="Synthetic image"
    />,
  );
  const link = await screen.findByRole('link', { name: 'Synthetic image' });
  expect(link.getAttribute('download')).toBe('Synthetic scan.png');
});
