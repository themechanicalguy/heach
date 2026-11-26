import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitWithin, prepareUpload, shrinkPhoto, withPrepared } from './photo';

describe('fitWithin (MA-06)', () => {
  it('scales the long edge down to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });

  it('never enlarges a small photo', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

it('shrinkPhoto returns the photo unchanged where it cannot be redrawn', async () => {
  const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  expect(await shrinkPhoto(photo)).toBe(photo);
});

/** A browser that decodes every image at this size and draws on a canvas that records its calls. */
function decodesAs(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  const drawn = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    drawn as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    done: BlobCallback,
  ) {
    done(new Blob([[this.width, this.height].join('x')], { type: 'image/jpeg' }));
  });
  return { close, drawn };
}

describe('prepareUpload (PO-02)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a PDF exactly as picked', async () => {
    decodesAs(4000, 3000);
    const pdf = new File(['%PDF'], 'degree.pdf', { type: 'application/pdf' });
    expect(await prepareUpload(pdf)).toBe(pdf);
  });

  it('sends a small, clear image exactly as picked', async () => {
    const { close } = decodesAs(1600, 1200);
    const scan = new File(['small'], 'licence.png', { type: 'image/png' });
    expect(await prepareUpload(scan)).toBe(scan);
    expect(close).toHaveBeenCalled();
  });

  it('redraws a large PNG as a JPEG within 2000 px, on white, keeping its name', async () => {
    const { drawn, close } = decodesAs(4000, 3000);
    const big = new File(['big'], 'registration.png', { type: 'image/png' });
    const sent = await prepareUpload(big);
    expect(sent).not.toBe(big);
    expect(sent).toMatchObject({ name: 'registration.jpg', type: 'image/jpeg' });
    expect(await sent.text()).toBe('2000x1500');
    expect(drawn.fillStyle).toBe('#ffffff');
    expect(drawn.fillRect).toHaveBeenCalledWith(0, 0, 2000, 1500);
    expect(close).toHaveBeenCalled();
  });

  it('redraws an image over 1 MB even when it is within 2000 px', async () => {
    decodesAs(1800, 1200);
    const heavy = new File([new Uint8Array(1024 * 1024 + 1)], 'photo.jpeg', {
      type: 'image/jpeg',
    });
    expect(await prepareUpload(heavy)).toMatchObject({ name: 'photo.jpg', type: 'image/jpeg' });
  });

  it('sends the original where the image cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad image')));
    const broken = new File([new Uint8Array(2 * 1024 * 1024)], 'x.jpg', { type: 'image/jpeg' });
    expect(await prepareUpload(broken)).toBe(broken);
  });
});

describe('withPrepared (PO-02)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hands a PDF on at once', () => {
    const use = vi.fn();
    const pdf = new File(['%PDF'], 'rx.pdf', { type: 'application/pdf' });
    withPrepared(pdf, use);
    expect(use.mock.calls).toEqual([[pdf]]);
  });

  it('holds nothing while a large image is redrawn, then hands on the smaller one', async () => {
    decodesAs(4000, 3000);
    const use = vi.fn();
    withPrepared(new File(['big'], 'scan.png', { type: 'image/png' }), use);
    expect(use.mock.calls).toEqual([[undefined]]);
    await vi.waitFor(() => {
      expect(use).toHaveBeenCalledTimes(2);
    });
    expect(use.mock.calls[1]?.[0]).toMatchObject({ name: 'scan.jpg', type: 'image/jpeg' });
  });
});
