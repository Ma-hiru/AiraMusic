import { useMemo, useState, useEffect } from "react";
import { Log } from "@/common/lib/log";
import { useStableArray } from "@/common/hooks/use-stable-array";
import MMCQWorker from "@/worker/mmcq.ts?worker";

const cache: Record<string, string[]> = {};
const worker = new MMCQWorker();
const pending = new Map<
  number,
  { reject: NormalFunc<[error: unknown]>; resolve: NormalFunc<[colors: string[]]> }
>();
const running = new Map<string, Promise<string[]>>();

let requestId = 0;
let workerError: Nullable<Error> = null;

worker.addEventListener("message", (e: MessageEvent<MMCQWorkerResult>) => {
  const data = e.data;
  if (!data) return;
  const request = pending.get(data.id);
  if (!request) return;
  pending.delete(data.id);
  if (data.type === "error") request.reject(new Error(data.error));
  else request.resolve(data.colors);
});
worker.addEventListener("error", (e) => {
  workerError = new Error(e.message);
  rejectPending(workerError);
});

import.meta.hot?.dispose(() => {
  worker.terminate();
  rejectPending(new Error("MMCQ worker disposed"));
});

function rejectPending(error: unknown) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function extractPalette(
  key: string,
  data: ArrayBuffer,
  dst_width: number,
  dst_height: number,
  count: number
) {
  if (cache[key]) return Promise.resolve(cache[key]);
  const current = running.get(key);
  if (current) return current;
  if (workerError) return Promise.reject(workerError);

  const id = ++requestId;
  const request = new Promise<string[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage(
      { id, type: "extract", data, dst_width, dst_height, count } satisfies MMCQWorkerArgs,
      [data]
    );
  })
    .then((colors) => {
      cache[key] = colors;
      return colors;
    })
    .finally(() => {
      pending.delete(id);
      running.delete(key);
    });

  running.set(key, request);
  return request;
}

export function useMMCQ(
  imageURL: Optional<string>,
  dst_width: number = 128,
  dst_height: number = 128,
  count: number = 16
) {
  const [result, setResult] = useState<string[]>([]);
  const stableResult = useStableArray(result);
  const key = useMemo(
    () => JSON.stringify([imageURL, dst_width, dst_height, count]),
    [count, dst_height, dst_width, imageURL]
  );

  useEffect(() => {
    if (!imageURL) return;
    if (cache[key]) return setResult(cache[key]);

    const controller = new AbortController();
    fetch(imageURL, {
      signal: controller.signal
    })
      .then((res) => {
        const type = res.headers.get("Content-Type");
        if (type && !(type.includes("image") || type.includes("octet-stream"))) {
          Log.throw({
            message: "invalid image type",
            label: "useMMCQ",
            raw: {
              type,
              imageURL
            }
          });
        }
        return res.arrayBuffer();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        return extractPalette(key, data, dst_width, dst_height, count);
      })
      .then((colors) => {
        if (controller.signal.aborted || !colors) return;
        setResult(colors);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        Log.error({
          raw: err,
          message: "failed to extract palette using MMCQ",
          label: "useMMCQ"
        });
      });
    return () => {
      controller.abort();
    };
  }, [count, dst_height, dst_width, imageURL, key]);

  return stableResult;
}
