/** Long edge of an uploaded photo: a page of text stays readable and the file stays small. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;
/** A picked image at or under this size and edge is sent as it is, so a clear scan stays exact. */
const SMALL_ENOUGH_BYTES = 1024 * 1024;
const REDRAWN_TYPES = new Set(['image/jpeg', 'image/png']);

/** The size that fits within `max` on its long edge, keeping the shape; never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** The image as a JPEG within the long-edge limit, or `undefined` where the browser cannot redraw it. */
async function redraw(image: File, bitmap: ImageBitmap): Promise<File | undefined> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  // A JPEG has no transparency: without a white ground, a PNG's clear parts turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });
  const name = `${image.name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`;
  return blob ? new File([blob], name, { type: 'image/jpeg' }) : undefined;
}

/** Decodes and, when `needed` says so, redraws the image; the original wherever that fails. */
async function shrinkIf(image: File, needed: (bitmap: ImageBitmap) => boolean): Promise<File> {
  if (typeof createImageBitmap !== 'function') return image;
  try {
    const bitmap = await createImageBitmap(image);
    try {
      return needed(bitmap) ? ((await redraw(image, bitmap)) ?? image) : image;
    } finally {
      bitmap.close();
    }
  } catch {
    return image;
  }
}

/**
 * A camera photo made small enough to upload (MA-06): phone cameras produce files over the
 * 5 MB upload limit, and patchy 4G makes large uploads fail. Returns the photo unchanged where
 * the browser cannot redraw it.
 */
export function shrinkPhoto(photo: File): Promise<File> {
  return shrinkIf(photo, () => true);
}

/**
 * A picked file ready to upload (PO-02): a JPEG or PNG over 2000 px or over 1 MB is redrawn as
 * a smaller JPEG; anything else (a PDF, a small scan) is sent exactly as picked.
 */
export function prepareUpload(file: File): Promise<File> {
  if (!REDRAWN_TYPES.has(file.type)) return Promise.resolve(file);
  return shrinkIf(
    file,
    (bitmap) => file.size > SMALL_ENOUGH_BYTES || Math.max(bitmap.width, bitmap.height) > MAX_EDGE,
  );
}

/**
 * Hands a picked file to `use`: at once when it is never redrawn (a PDF), otherwise nothing until
 * `prepareUpload` is done, so a Save in between cannot send the previous file.
 */
export function withPrepared(
  picked: File | undefined,
  use: (file: File | undefined) => void,
): void {
  if (!picked || !REDRAWN_TYPES.has(picked.type)) {
    use(picked);
    return;
  }
  use(undefined);
  void prepareUpload(picked).then(use);
}
