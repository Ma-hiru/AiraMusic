import { useEffect, useRef, useState } from "react";
import { useImageCache } from "@mahiru/ui/ctx/ImageCacheProvider";

function useLazyImage(url?: string) {
  const { bitmap, blob, cache } = useImageCache(url);
  const [visible, setVisible] = useState(false);
  const ref = useRef<Nullable<HTMLElement>>(null);
  useEffect(() => {
    if (!url || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true);
      },
      { rootMargin: "500px" }
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, [url]);
  useEffect(() => {
    if (!visible || !url) return;
    if (cache.bitmaps.has(url)) return; // 已 decode，无需处理
    const worker = new Worker(new URL("@mahiru/ui/worker/image.ts", import.meta.url));
    worker.postMessage({ url });
    worker.onmessage = (e) => {
      const { blob, bitmap } = e.data;
      cache.blobs.set(url, blob);
      cache.bitmaps.set(url, bitmap);
    };
  }, [cache.bitmaps, cache.blobs, url, visible]);
  return { ref, blob, bitmap };
}
