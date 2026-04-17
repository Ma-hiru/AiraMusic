import { extractPalette, FilterOptions } from "@mahiru/wasm";
import { useEffect, useState } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/constants/errs";
import { useStableArray } from "@mahiru/ui/public/hooks/useStableArray";

const cache: Record<string, string[]> = {};

export function useMMCQ(
  imageURL: Optional<string>,
  dst_width: number = 64,
  dst_height: number = 64,
  count: number = 5,
  options: Optional<FilterOptions> = null
) {
  const [result, setResult] = useState<string[]>([]);
  const stableResult = useStableArray(result);

  useEffect(() => {
    if (!imageURL) return;
    if (cache[imageURL]) return setResult(cache[imageURL]);
    const controller = new AbortController();
    requestAnimationFrame(() => {
      fetch(imageURL, {
        signal: controller.signal
      })
        .then((res) => {
          const type = res.headers.get("Content-Type");
          if (type && !(type.includes("image") || type.includes("octet-stream"))) {
            throw Errs.FetchedNotImage.derive("useMMCQ.ts");
          }
          return res.arrayBuffer();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          const result = extractPalette(
            new Uint8Array(data),
            dst_width,
            dst_height,
            count,
            options
          );
          if (controller.signal.aborted) return;
          setResult(result);
          cache[imageURL] = result;
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          Log.error({
            raw: err,
            message: "failed to extract palette using MMCQ",
            label: "useMMCQ.ts"
          });
        });
    });
    return () => {
      controller.abort();
    };
  }, [count, dst_height, dst_width, imageURL, options]);

  return stableResult;
}
