import { createContext, useContext } from "react";

export class ImgCache {
  blobs = new Map<string, Blob>();
  bitmaps = new Map<string, ImageBitmap>();
}

export const ImageCacheCtx = createContext(new ImgCache());

export function useImageCache(url?: string) {
  const cache = useContext(ImageCacheCtx);
  const blob = url ? cache.blobs.get(url) : null;
  const bitmap = url ? cache.bitmaps.get(url) : null;
  return { cache, blob, bitmap };
}
