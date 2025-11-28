import { kmeans, KMeansOption } from "@mahiru/wasm";

export type KMeansWorkerArgs = {
  id: number;
  url: string;
  option: KMeansOption;
};
export type KMeansWorkerResult = {
  ok: boolean;
  id: number;
  result: string[];
  error?: string;
};

self.addEventListener("message", async (e: MessageEvent<KMeansWorkerArgs>) => {
  const { id, url, option } = e.data;
  try {
    const arrayBuffer = await fetch(url).then((res) => res.arrayBuffer());
    const uint8Array = new Uint8Array(arrayBuffer);
    const result = kmeans(uint8Array, option);
    self.postMessage({ id, result, ok: true } satisfies KMeansWorkerResult);
  } catch (err) {
    self.postMessage({
      id,
      error: err?.toString(),
      result: [],
      ok: false
    } satisfies KMeansWorkerResult);
  }
});
