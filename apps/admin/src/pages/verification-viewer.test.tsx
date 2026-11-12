import { fireEvent, render, screen } from '@testing-library/react';
import { StoredFileButton } from './StoredFileButton';
import en from '../../messages/en.json';

const open = en.verification.download;
const viewer = en.verification.viewer;

function stubFile(contentType: string) {
  const fetchFile = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ contentType, contentBase64: btoa('synthetic') })),
    ),
  );
  vi.stubGlobal('fetch', fetchFile);
  return fetchFile;
}

async function openImage() {
  render(<StoredFileButton path="/applications/a/photo" />);
  fireEvent.click(screen.getByRole('button', { name: open }));
  return screen.findByRole('img', { name: viewer.imageAlt });
}

const revoke = vi.fn();

beforeEach(() => {
  revoke.mockClear();
  URL.createObjectURL = vi.fn(() => 'blob:synthetic');
  URL.revokeObjectURL = revoke;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Document viewer (AD-02)', () => {
  it('AD-02 an image opens in the page, not in a new tab', async () => {
    const fetchFile = stubFile('image/png');
    const image = await openImage();
    expect(image.getAttribute('src')).toBe('blob:synthetic');
    expect(screen.queryByRole('link')).toBeNull();
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('AD-02 zoom and rotate change the transform; reset restores it; no extra fetches', async () => {
    const fetchFile = stubFile('image/jpeg');
    const image = await openImage();
    const click = (name: string) => {
      fireEvent.click(screen.getByRole('button', { name }));
    };
    expect(image.style.transform).toBe('scale(1) rotate(0deg)');
    click(viewer.zoomIn);
    expect(image.style.transform).toBe('scale(1.25) rotate(0deg)');
    click(viewer.zoomOut);
    click(viewer.zoomOut);
    expect(image.style.transform).toBe('scale(0.75) rotate(0deg)');
    click(viewer.rotateRight);
    click(viewer.rotateRight);
    click(viewer.rotateLeft);
    expect(image.style.transform).toBe('scale(0.75) rotate(90deg)');
    click(viewer.reset);
    expect(image.style.transform).toBe('scale(1) rotate(0deg)');
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it('AD-02 zoom stops at its limits', async () => {
    stubFile('image/png');
    await openImage();
    const zoomIn = screen.getByRole<HTMLButtonElement>('button', { name: viewer.zoomIn });
    for (let step = 0; step < 12; step += 1) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
    const zoomOut = screen.getByRole<HTMLButtonElement>('button', { name: viewer.zoomOut });
    for (let step = 0; step < 20; step += 1) fireEvent.click(zoomOut);
    expect(zoomOut.disabled).toBe(true);
  });

  it('AD-02 closing the viewer revokes the object URL and offers the file again', async () => {
    stubFile('image/png');
    await openImage();
    fireEvent.click(screen.getByRole('button', { name: en.verification.close }));
    expect(revoke).toHaveBeenCalledWith('blob:synthetic');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: open })).toBeTruthy();
  });

  it('AD-02 leaving the page with the viewer open revokes the object URL', async () => {
    stubFile('image/png');
    const { unmount } = render(<StoredFileButton path="/applications/a/photo" />);
    fireEvent.click(screen.getByRole('button', { name: open }));
    await screen.findByRole('img', { name: viewer.imageAlt });
    expect(revoke).not.toHaveBeenCalled();
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:synthetic');
  });

  it('AD-02 a PDF still opens as a link to a new tab', async () => {
    stubFile('application/pdf');
    render(<StoredFileButton path="/applications/a/documents/d" />);
    fireEvent.click(screen.getByRole('button', { name: open }));
    const link = await screen.findByRole('link', { name: open });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe('blob:synthetic');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
