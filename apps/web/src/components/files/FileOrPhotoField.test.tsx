import { fireEvent, render, screen } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import { I18nProvider } from '../../lib/i18n-context';
import { FileOrPhotoField } from './FileOrPhotoField';

const APP_AGENT = 'Mozilla/5.0 (Linux; Android 16) Chrome/140 HeachApp/patient';

function show(onFile = vi.fn()) {
  const view = render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <FileOrPhotoField label="File" accept="application/pdf" onFile={onFile} />
    </I18nProvider>,
  );
  return { onFile, camera: view.container.querySelector('input[capture]') };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it('offers only the file field in a browser', () => {
  const { camera } = show();
  expect(screen.getByLabelText('File').getAttribute('accept')).toBe('application/pdf');
  expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();
  expect(camera).toBeNull();
});

it('adds a camera button inside the Android apps and reports the photo (MA-06)', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(APP_AGENT);
  const { onFile, camera } = show();
  expect(screen.getByRole('button', { name: 'Take a photo' })).toBeTruthy();
  expect(camera?.getAttribute('capture')).toBe('environment');
  const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  if (camera) fireEvent.change(camera, { target: { files: [photo] } });
  expect(await screen.findByText('Photo added.')).toBeTruthy();
  expect(onFile).toHaveBeenCalledWith(photo);
});
