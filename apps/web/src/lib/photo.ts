/** Long edge of an uploaded photo: a page of text stays readable and the file stays small. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/** The size that fits within `max` on its long edge, keeping the shape; never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * A camera photo made small enough to upload (MA-06): phone cameras produce files over the
 * 5 MB upload limit, and patchy 4G makes large uploads fail. Returns the photo unchanged where
 * the browser cannot redraw it.
 */
export async function shrinkPhoto(photo: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return photo;
  try {
    const bitmap = await createImageBitmap(photo);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : photo;
  } catch {
    return photo;
  }
}
