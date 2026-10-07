import init, { extractPalette } from "@mahiru/wasm";

let ready: Nullable<ReturnType<typeof init>> = null;

self.addEventListener("message", async (e: MessageEvent<MMCQWorkerArgs>) => {
  const data = e.data;
  if (!data || data.type !== "extract") return;
  try {
    await (ready ??= init());
    const colors = extractPalette(
      new Uint8Array(data.data),
      data.dst_width,
      data.dst_height,
      data.count
    );
    self.postMessage({ id: data.id, type: "palette", colors } satisfies MMCQWorkerResult);
  } catch (err) {
    self.postMessage({
      id: data.id,
      type: "error",
      error: "failed to extract palette using MMCQ: " + String(err)
    } satisfies MMCQWorkerResult);
  }
});
