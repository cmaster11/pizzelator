import { useEffect, useState } from 'react';

import type { SourceImage } from '../engine/types';
import type { CropRect } from '../lib/crop';
import { decodeImage } from '../lib/image';
import type { LoadedImage } from './ImageInput';

export interface Source {
  info: LoadedImage;
  pixels: SourceImage;
}

/**
 * The input image and its selected area. `load` decodes a file, or a file
 * still to be fetched, replaces the image and clears the area; it resolves to
 * the new pixels, or null after showing why the image could not be read.
 */
export function useSourceImage() {
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (source !== null) {
        URL.revokeObjectURL(source.info.url);
      }
    },
    [source],
  );

  const load = async (file: File | (() => Promise<File>)): Promise<SourceImage | null> => {
    setLoading(true);
    setError(null);
    try {
      const picked = typeof file === 'function' ? await file() : file;
      const pixels = await decodeImage(picked);
      const info = {
        name: picked.name,
        url: URL.createObjectURL(picked),
        width: pixels.width,
        height: pixels.height,
      };
      setSource({ info, pixels });
      setCrop(null);
      return pixels;
    } catch (err) {
      setError(`Could not read this image: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { source, crop, setCrop, loading, error, load };
}
