import { EventEmitter } from "node:events";
import { getNetworkStatus, probeNetworkStatus } from "@mahiru/app/lib/network-status";

const mocks = vi.hoisted(() => ({
  resolve4: vi.fn(),
  cancel: vi.fn(),
  connect: vi.fn(),
  request: vi.fn()
}));

vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = mocks.resolve4;
    cancel = mocks.cancel;
  }
}));
vi.mock("node:net", () => ({ default: { createConnection: mocks.connect } }));
vi.mock("node:https", () => ({ default: { request: mocks.request } }));

class Connection extends EventEmitter {
  destroy = vi.fn(() => this);
  end = vi.fn();
}

let socket: Connection;
let request: Connection;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  socket = new Connection();
  request = new Connection();
  mocks.resolve4.mockResolvedValue(["1.2.3.4"]);
  mocks.connect.mockReturnValue(socket);
  mocks.request.mockReturnValue(request);
});

afterEach(() => vi.useRealTimers());

it("cancels stalled DNS at the deadline without starting later stages", async () => {
  mocks.resolve4.mockReturnValue(new Promise(() => {}));
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(5_000);
  await expect(result).resolves.toBe("dns_error");
  expect(mocks.cancel).toHaveBeenCalledOnce();
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("destroys a TCP connection that never connects", async () => {
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(5_000);
  await expect(result).resolves.toBe("tcp_error");
  expect(socket.destroy).toHaveBeenCalledOnce();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("uses one total deadline and destroys a stalled HTTPS request", async () => {
  mocks.resolve4.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve(["1.2.3.4"]), 2_000))
  );
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(4_000);
  socket.emit("connect");
  expect(request.end).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(999);
  expect(request.destroy).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toBe("tls_error");
  expect(request.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("reuses the resolved address and cleans up as soon as response headers arrive", async () => {
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(0);
  socket.emit("connect");
  const [options, respond] = mocks.request.mock.calls[0]!;
  const lookup = vi.fn();
  options.lookup("www.baidu.com", {}, lookup);
  expect(lookup).toHaveBeenCalledWith(null, "1.2.3.4", 4);
  const response = Object.assign(new EventEmitter(), { statusCode: 200, resume: vi.fn() });
  respond(response);
  await expect(result).resolves.toBe("ok");
  expect(response.resume).toHaveBeenCalledOnce();
  expect(request.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([204, 301, 302, 403, 405, 429, 500, 503])(
  "treats HTTP %i as reachable without waiting for the response to end",
  async (statusCode) => {
    const result = probeNetworkStatus();
    await vi.advanceTimersByTimeAsync(0);
    socket.emit("connect");
    const response = Object.assign(new EventEmitter(), { statusCode, resume: vi.fn() });
    mocks.request.mock.calls[0]![1](response);
    await expect(result).resolves.toBe("ok");
    expect(request.destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  }
);

it("keeps the reachable result when cleanup aborts an already received response", async () => {
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(0);
  socket.emit("connect");
  const response = Object.assign(new EventEmitter(), { statusCode: 200, resume: vi.fn() });
  mocks.request.mock.calls[0]![1](response);
  response.emit("error", new Error("response aborted"));
  request.emit("error", new Error("connection closed"));
  await expect(result).resolves.toBe("ok");
  expect(request.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not replace a timeout result with late response headers", async () => {
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(0);
  socket.emit("connect");
  await vi.advanceTimersByTimeAsync(5_000);
  const response = Object.assign(new EventEmitter(), { statusCode: 200, resume: vi.fn() });
  mocks.request.mock.calls[0]![1](response);
  await expect(result).resolves.toBe("tls_error");
  expect(request.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["tcp", "https"])("settles and releases resources on a %s error", async (stage) => {
  const result = probeNetworkStatus();
  await vi.advanceTimersByTimeAsync(0);
  if (stage === "https") socket.emit("connect");
  (stage === "tcp" ? socket : request).emit("error", new Error("connection failed"));
  await expect(result).resolves.toBe(stage === "tcp" ? "tcp_error" : "tls_error");
  expect(socket.destroy).toHaveBeenCalled();
  if (stage === "https") expect(request.destroy).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("shares an in-flight probe across callers and releases it after settlement", async () => {
  mocks.resolve4.mockRejectedValue(new Error("DNS failed"));
  const first = getNetworkStatus();
  expect(getNetworkStatus()).toBe(first);
  await expect(first).resolves.toBe("dns_error");
  await expect(getNetworkStatus()).resolves.toBe("dns_error");
  expect(mocks.resolve4).toHaveBeenCalledTimes(2);
});
