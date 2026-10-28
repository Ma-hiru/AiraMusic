import { act, cleanup, renderHook } from "@testing-library/react";
import { useOnline } from "@mahiru/ui/common/hooks/use-online";

const mocks = vi.hoisted(() => ({ checkStatus: vi.fn(), onChange: vi.fn() }));
vi.mock("@/common/lib/net", () => ({
  RendererNet: { checkStatus: mocks.checkStatus, onOnlineChange: mocks.onChange }
}));

let notify: () => void;
const unlisten = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.onChange.mockImplementation((callback) => {
    notify = callback;
    return unlisten;
  });
});
afterEach(cleanup);

it("keeps the failure visible during retry, catches rejection and permits another retry", async () => {
  mocks.checkStatus.mockResolvedValueOnce("dns_error");
  const { result } = renderHook(() => useOnline(true));
  await act(async () => {});
  expect(result.current.online).toBe(false);
  const retry = deferred<NetworkStatus>();
  mocks.checkStatus.mockReturnValueOnce(retry.promise);
  act(() => void result.current.refresh());
  expect(result.current).toMatchObject({ online: false, pending: true });
  await act(async () => retry.reject(new Error("IPC rejected")));
  expect(result.current).toMatchObject({ online: false, pending: false });
  mocks.checkStatus.mockResolvedValueOnce("ok");
  await act(async () => result.current.refresh());
  expect(result.current).toMatchObject({ online: true, pending: false });
  expect(mocks.checkStatus).toHaveBeenLastCalledWith(true);
  act(() => notify());
  expect(mocks.checkStatus).toHaveBeenCalledTimes(3);
});

it("does not latch a failed initial check and retries after an online event", async () => {
  mocks.checkStatus.mockRejectedValueOnce(new Error("IPC failed")).mockResolvedValueOnce("ok");
  const { result } = renderHook(() => useOnline(true));
  await act(async () => {});
  expect(result.current.online).toBe(false);
  await act(async () => notify());
  expect(result.current.online).toBe(true);
});

it("ignores older results and their pending state after a newer request completes", async () => {
  const first = deferred<NetworkStatus>();
  const second = deferred<NetworkStatus>();
  mocks.checkStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useOnline());
  act(() => void result.current.refresh());
  await act(async () => second.resolve("ok"));
  expect(result.current).toMatchObject({ online: true, pending: false });
  await act(async () => first.resolve("dns_error"));
  expect(result.current).toMatchObject({ online: true, pending: false });
});

it("unsubscribes and safely handles a late rejected request after unmount", async () => {
  const check = deferred<NetworkStatus>();
  mocks.checkStatus.mockReturnValue(check.promise);
  const { unmount } = renderHook(() => useOnline());
  unmount();
  await act(async () => check.reject(new Error("late failure")));
  expect(unlisten).toHaveBeenCalledOnce();
});
