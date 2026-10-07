import { act, cleanup, waitFor, renderHook } from "@testing-library/react";
import { useMMCQ } from "@mahiru/ui/wins/main/hooks/use-mmcq";

import { Log } from "../mock/log";
import { mmcqWorkerMock } from "../mock/mmcq-worker";

vi.mock("@/worker/mmcq.ts?worker", async () => {
  const { MockMMCQWorker } = await import("../mock/mmcq-worker");
  return { default: MockMMCQWorker };
});

beforeEach(() => {
  latestWorker().messages.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      headers: new Headers({ "Content-Type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shares one worker and one calculation between both hook instances", async () => {
  const first = renderHook(() => useMMCQ("shared-cover"));
  const second = renderHook(() => useMMCQ("shared-cover"));
  await waitFor(() => expect(latestWorker().messages).toHaveLength(1));
  expect(mmcqWorkerMock.instances).toHaveLength(1);
  const { message, transfer } = latestWorker().messages[0]!;
  expect(message).toMatchObject({ type: "extract", dst_width: 128, dst_height: 128, count: 16 });
  expect(transfer?.[0]).toBe(message.data);

  first.unmount();
  act(() => latestWorker().emit({ id: message.id, type: "palette", colors: ["red", "blue"] }));
  await waitFor(() => expect(second.result.current).toEqual(["red", "blue"]));
  expect(latestWorker().terminated).toBe(false);
});

it("matches responses by request id and ignores results from a previous cover", async () => {
  const { result, rerender } = renderHook(({ url }) => useMMCQ(url), {
    initialProps: { url: "old-cover" }
  });
  await waitFor(() => expect(latestWorker().messages).toHaveLength(1));
  const oldRequest = latestWorker().messages[0]!.message;
  const signal = vi.mocked(fetch).mock.calls[0]![1]?.signal;

  rerender({ url: "new-cover" });
  expect(signal?.aborted).toBe(true);
  await waitFor(() => expect(latestWorker().messages).toHaveLength(2));
  const newRequest = latestWorker().messages[1]!.message;
  act(() => latestWorker().emit({ id: newRequest.id, type: "palette", colors: ["green"] }));
  await waitFor(() => expect(result.current).toEqual(["green"]));
  await act(async () => {
    latestWorker().emit({ id: oldRequest.id, type: "palette", colors: ["red"] });
  });
  expect(result.current).toEqual(["green"]);
});

it("includes extraction settings in the cache key", async () => {
  const { result, rerender } = renderHook(({ count }) => useMMCQ("sized-cover", 64, 32, count), {
    initialProps: { count: 2 }
  });
  await waitFor(() => expect(latestWorker().messages).toHaveLength(1));
  let request = latestWorker().messages[0]!.message;
  expect(request).toMatchObject({ dst_width: 64, dst_height: 32, count: 2 });
  act(() => latestWorker().emit({ id: request.id, type: "palette", colors: ["red", "blue"] }));
  await waitFor(() => expect(result.current).toHaveLength(2));

  rerender({ count: 3 });
  await waitFor(() => expect(latestWorker().messages).toHaveLength(2));
  request = latestWorker().messages[1]!.message;
  act(() =>
    latestWorker().emit({ id: request.id, type: "palette", colors: ["red", "blue", "green"] })
  );
  await waitFor(() => expect(result.current).toHaveLength(3));

  rerender({ count: 2 });
  expect(result.current).toEqual(["red", "blue"]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(latestWorker().messages).toHaveLength(2);
});

it("allows retrying a failed extraction without keeping a rejected cache entry", async () => {
  const first = renderHook(() => useMMCQ("retry-cover"));
  await waitFor(() => expect(latestWorker().messages).toHaveLength(1));
  let request = latestWorker().messages[0]!.message;
  act(() => latestWorker().emit({ id: request.id, type: "error", error: "extraction failed" }));
  await waitFor(() => expect(Log.error).toHaveBeenCalledTimes(1));
  first.unmount();

  const second = renderHook(() => useMMCQ("retry-cover"));
  await waitFor(() => expect(latestWorker().messages).toHaveLength(2));
  request = latestWorker().messages[1]!.message;
  act(() => latestWorker().emit({ id: request.id, type: "palette", colors: ["blue"] }));
  await waitFor(() => expect(second.result.current).toEqual(["blue"]));
});

it("rejects all pending calculations when the shared worker fails", async () => {
  renderHook(() => useMMCQ("failed-worker-first"));
  renderHook(() => useMMCQ("failed-worker-second"));
  await waitFor(() => expect(latestWorker().messages).toHaveLength(2));
  act(() => latestWorker().emitError("worker failed"));
  await waitFor(() => expect(Log.error).toHaveBeenCalledTimes(2));

  renderHook(() => useMMCQ("failed-worker-third"));
  await waitFor(() => expect(Log.error).toHaveBeenCalledTimes(3));
  expect(latestWorker().messages).toHaveLength(2);
});

function latestWorker() {
  return mmcqWorkerMock.instances[0]!;
}
