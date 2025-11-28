import { kmeans, KMeansOption } from "@mahiru/wasm";
import { useEffect } from "react";

export function useKmeans(url?: string) {
  useEffect(() => {
    if (url) {
      fetch(url)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          const uint8Array = new Uint8Array(buffer);
          const result = kmeans(uint8Array, KMeansOption.default());
        });
    }
  }, [url]);
}
