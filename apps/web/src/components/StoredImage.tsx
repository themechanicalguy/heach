'use client';

import { useResource } from '../lib/use-resource';

interface StoredFile {
  contentType: string;
  contentBase64: string;
}

/** A stored image fetched from the API and shown from memory; nothing while loading or missing. */
export function StoredImage({ path, alt }: Readonly<{ path: string; alt: string }>) {
  const { resource } = useResource<StoredFile>(path);
  if (resource.state !== 'ready') return null;
  const { contentType, contentBase64 } = resource.data;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a data URL from the API, not a static asset
    <img
      className="profile-photo"
      src={`data:${contentType};base64,${contentBase64}`}
      alt={alt}
      width={96}
      height={96}
    />
  );
}
