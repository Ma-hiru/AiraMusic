import { RendererNet } from "@mahiru/ui/common/lib/net";

const mocks = vi.hoisted(() => {
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      observe() {}
    }
  );
  return { send: vi.fn() };
});
vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: { NormalChannel: { send: mocks.send } }
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.send.mockReset();
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  window.dispatchEvent(new Event("online"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(() => vi.unstubAllGlobals());

it("shares one probe, reuses a short-lived result and allows an explicit refresh", async () => {
  let resolve!: (value: NetworkStatus) => void;
  mocks.send.mockReturnValueOnce(
    new Promise<NetworkStatus>((res) => {
      resolve = res;
    })
  );
  const first = RendererNet.status;
  expect(RendererNet.status).toBe(first);
  expect(RendererNet.checkStatus(true)).toBe(first);
  await Promise.resolve();
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith("invoke_device_net", undefined);
  resolve("dns_error");
  await expect(first).resolves.toBe("dns_error");
  await expect(RendererNet.status).resolves.toBe("dns_error");
  expect(mocks.send).toHaveBeenCalledOnce();
  mocks.send.mockResolvedValue("ok");
  await expect(RendererNet.checkStatus(true)).resolves.toBe("ok");
  expect(mocks.send).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(2_501);
  await expect(RendererNet.status).resolves.toBe("ok");
  expect(mocks.send).toHaveBeenCalledTimes(3);
});

it("does not cache an IPC failure and permits recovery", async () => {
  mocks.send.mockRejectedValueOnce(new Error("IPC failed")).mockResolvedValueOnce("ok");
  await expect(RendererNet.status).rejects.toThrow("IPC failed");
  await expect(RendererNet.status).resolves.toBe("ok");
  expect(mocks.send).toHaveBeenCalledTimes(2);
});

it("invalidates old results when the system network changes and skips IPC while offline", async () => {
  let resolve!: (value: NetworkStatus) => void;
  mocks.send.mockReturnValueOnce(
    new Promise<NetworkStatus>((res) => {
      resolve = res;
    })
  );
  const first = RendererNet.status;
  await Promise.resolve();
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
  window.dispatchEvent(new Event("offline"));
  await expect(RendererNet.status).resolves.toBe("offline");
  resolve("ok");
  await first;
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  window.dispatchEvent(new Event("online"));
  mocks.send.mockResolvedValue("tcp_error");
  await expect(RendererNet.status).resolves.toBe("tcp_error");
  expect(mocks.send).toHaveBeenCalledTimes(2);
});
