import { fireEvent, render, screen } from '@testing-library/react';
import { FileOrPhotoField } from './FileOrPhotoField';
import { CATALOGUES } from '@heach/i18n';
import { I18nProvider } from '../../lib/i18n-context';

const APP_AGENT = 'Mozilla/5.0 (Linux; Android 16) Chrome/140 HeachApp/patient';

function show(onFile = vi.fn()) {
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <FileOrPhotoField label="File" accept="application/pdf" onFile={onFile} />
    </I18nProvider>,
  );
  return onFile;
}

afterEach(() => {
  vi.restoreAllMocks();
});

it('offers only the file field in a browser', () => {
  show();
  expect(screen.getByLabelText('File').getAttribute('accept')).toBe('application/pdf');
  expect(screen.queryByLabelText('Take a photo')).toBeNull();
});

it('adds a camera field inside the Android apps and reports the photo (MA-06)', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(APP_AGENT);
  const onFile = show();
  const camera = screen.getByLabelText('Take a photo');
  expect(camera.getAttribute('capture')).toBe('environment');
  const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(camera, { target: { files: [photo] } });
  expect(onFile).toHaveBeenCalledWith(photo);
});
