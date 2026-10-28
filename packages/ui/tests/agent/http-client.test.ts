import { TextEncoder } from "node:util";
import { ReadableStream } from "node:stream/web";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  request: vi.fn(),
  get: vi.fn(),
  send: vi.fn(),
  listen: vi.fn(),
  unsubscribe: vi.fn()
}));
vi.mock("axios", () => ({
  default: {
    create: mocks.create,
    isAxiosError: (value: unknown) =>
      Boolean(value && typeof value === "object" && "isAxiosError" in value)
  }
}));
vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: {
    NormalChannel: { send: mocks.send },
    MessageChannel: { listen: mocks.listen }
  }
}));

let RendererAgent: typeof import("@mahiru/ui/wins/agent/lib/agent").RendererAgent;
let decodeAgentEvents: typeof import("@mahiru/ui/wins/agent/lib/agent").decodeAgentEvents;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.get.mockReset();
  mocks.send.mockResolvedValue({
    ok: true,
    data: { endpoint: "http://127.0.0.1:34567", token: "test-token" }
  });
  mocks.create.mockReturnValue({ request: mocks.request, get: mocks.get });
  mocks.listen.mockReturnValue(mocks.unsubscribe);
  mocks.request.mockResolvedValue({ status: 200, data: [] });
  ({ RendererAgent, decodeAgentEvents } = await import("@mahiru/ui/wins/agent/lib/agent"));
});

afterEach(() => vi.useRealTimers());

it("只通过 IPC 获取一次连接，后续控制请求直接使用 Axios", async () => {
  await Promise.all([RendererAgent.listThreads(), RendererAgent.listConfigs()]);
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith("invoke_agent_connection", undefined);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      baseURL: "http://127.0.0.1:34567",
      headers: { Authorization: "Bearer test-token" }
    })
  );
  expect(mocks.request).toHaveBeenCalledWith({ url: "/v1/threads" });
  expect(mocks.request).toHaveBeenCalledWith({ url: "/v1/configs" });
  await RendererAgent.getThread("thread/a");
  expect(mocks.request).toHaveBeenLastCalledWith({ url: "/v1/threads/thread%2Fa" });
});

it("创建 run 先绑定配置，绑定失败时不提交 run", async () => {
  mocks.request
    .mockResolvedValueOnce({ status: 204 })
    .mockResolvedValueOnce({ status: 202, data: { threadId: "a", runId: "r" } });
  expect(await RendererAgent.createRun({ threadId: "a", configId: "c", content: "hello" })).toEqual(
    { ok: true, data: { threadId: "a", runId: "r" } }
  );
  expect(mocks.request.mock.calls.map(([value]) => value)).toEqual([
    { url: "/v1/threads/a/config", method: "PUT", data: { configId: "c" } },
    { url: "/v1/threads/a/runs", method: "POST", data: { content: "hello" } }
  ]);
  mocks.request.mockClear().mockRejectedValueOnce({
    isAxiosError: true,
    response: { data: { code: "config_not_found", message: "missing" } }
  });
  expect(
    await RendererAgent.createRun({ threadId: "a", configId: "missing", content: "hello" })
  ).toEqual({ ok: false, reason: { code: "config_not_found", message: "missing" } });
  expect(mocks.request).toHaveBeenCalledOnce();
});

it("连接未就绪后可重试，并正确处理 204", async () => {
  mocks.send.mockResolvedValueOnce({
    ok: false,
    reason: { code: "unknown", message: "not ready" }
  });
  expect(await RendererAgent.listThreads()).toEqual({
    ok: false,
    reason: { code: "unknown", message: "not ready" }
  });
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.request.mockResolvedValueOnce({ status: 204 });
  expect(await RendererAgent.cancelRun("run/a")).toEqual({ ok: true, data: undefined });
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.request).toHaveBeenLastCalledWith({
    url: "/v1/runs/run%2Fa/cancel",
    method: "POST"
  });
});

it("SSE 解码支持跨字节 UTF-8、CRLF、多行 data 和 keepalive", async () => {
  const event = {
    type: "TEXT_MESSAGE_CONTENT",
    threadId: "t",
    runId: "r",
    messageId: "m",
    delta: "你好"
  };
  const encoded = new TextEncoder().encode(
    `: keepalive\r\n\r\ndata: {"type":"TEXT_MESSAGE_CONTENT",\r\ndata: "threadId":"t","runId":"r","messageId":"m","delta":"你好"}\r\n\r\n`
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }
  });
  const received = [];
  for await (const value of decodeAgentEvents(stream as globalThis.ReadableStream<Uint8Array>))
    received.push(value);
  expect(received).toEqual([event]);
  expect(stream.locked).toBe(false);
});

it("事件连接失败后同步会话，取消会终止阻塞的 reader", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  mocks.get.mockRejectedValueOnce(new Error("reset")).mockResolvedValue({ data: stream });
  const onReconnect = vi.fn();
  const stop = RendererAgent.listenEvents(vi.fn(), { onReconnect });
  try {
    await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(mocks.get).toHaveBeenLastCalledWith(
      "/v1/events",
      expect.objectContaining({
        adapter: "fetch",
        responseType: "stream",
        timeout: 0,
        signal: expect.any(AbortSignal)
      })
    );
    expect(onReconnect).toHaveBeenCalledOnce();
    stop();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(stream.locked).toBe(false));
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
});

it("连续断线指数退避，等待时间最多 30 秒且不重新获取连接", async () => {
  vi.useFakeTimers();
  mocks.get.mockRejectedValue(new Error("offline"));
  const stop = RendererAgent.listenEvents(vi.fn());
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    for (const [index, delay] of [
      500, 1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000
    ].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(mocks.get).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mocks.get).toHaveBeenCalledTimes(index + 2);
    }
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith("invoke_agent_connection", undefined);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.get).toHaveBeenCalledTimes(9);
  } finally {
    stop();
  }
});

it.each([401, 404])("HTTP %i 不盲目重连", async (status) => {
  vi.useFakeTimers();
  mocks.get.mockRejectedValue({ isAxiosError: true, response: { status } });
  const onUnavailable = vi.fn();
  const stop = RendererAgent.listenEvents(vi.fn(), { onUnavailable });
  try {
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(onUnavailable).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
});

it("IPC 明确报告未运行后停止，运行状态关闭时取消 reader", async () => {
  vi.useFakeTimers();
  mocks.send.mockResolvedValueOnce({
    ok: false,
    reason: { code: "unknown", message: "Agent 本次启动未运行；请重启应用" }
  });
  const stopUnavailable = RendererAgent.listenEvents(vi.fn());
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.send).toHaveBeenCalledOnce();
  expect(mocks.get).not.toHaveBeenCalled();
  stopUnavailable();

  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  mocks.get.mockResolvedValue({ data: stream });
  const stop = RendererAgent.listenEvents(vi.fn());
  try {
    await vi.advanceTimersByTimeAsync(0);
    const onState = mocks.listen.mock.calls.at(-1)?.[2];
    onState({ effective: { agentEnabled: false } });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(mocks.get).toHaveBeenCalledOnce();
  } finally {
    stop();
  }
});
