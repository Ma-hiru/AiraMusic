import init, { kmeans, KMeansOption } from "@mahiru/wasm";

let initialized = false;

self.addEventListener("message", async (e: MessageEvent<KMeansWorkerArgs>) => {
  if (!initialized) {
    await init();
    initialized = true;
  }
  const { id, url } = e.data;
  try {
    const arrayBuffer = await fetch(url).then((res) => res.arrayBuffer());
    const uint8Array = new Uint8Array(arrayBuffer);
    const result = kmeans(uint8Array, KMeansOption.default());
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
