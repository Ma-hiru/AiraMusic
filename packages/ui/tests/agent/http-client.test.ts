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
  mocks.send.mockImplementation(async (type) =>
    type === "invoke_agent_context"
      ? { ok: false, reason: { code: "unavailable", message: "No context" } }
      : { ok: true, data: { endpoint: "http://127.0.0.1:34567", token: "test-token" } }
  );
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

it("每轮发送前读取最新页面上下文，保留用户原文并独立附带短 JSON", async () => {
  const pages = [
    { window: "display", page: { page: "album", id: 123, name: "当前专辑" }, currentTrack: null },
    { window: "main", page: { page: "search", keyword: "新的查询" }, currentTrack: null }
  ];
  let contextIndex = 0;
  mocks.send.mockImplementation(async (type) =>
    type === "invoke_agent_context"
      ? { ok: true, data: pages[contextIndex++] }
      : { ok: true, data: { endpoint: "http://127.0.0.1:34567", token: "test-token" } }
  );
  await RendererAgent.createRun({ threadId: "a", configId: "c", content: "介绍这个" });
  await RendererAgent.createRun({ threadId: "a", configId: "c", content: "继续" });
  expect(
    mocks.request.mock.calls
      .map(([request]) => request)
      .filter(({ method }) => method === "POST")
      .map(({ data }) => data)
  ).toEqual([
    { content: "介绍这个", context: JSON.stringify(pages[0]) },
    { content: "继续", context: JSON.stringify(pages[1]) }
  ]);
});

it("上下文读取失败或超出限制不阻止提交，也不裁断 JSON", async () => {
  mocks.send.mockImplementation(async (type) => {
    if (type === "invoke_agent_context") throw new Error("IPC disconnected");
    return { ok: true, data: { endpoint: "http://127.0.0.1:34567", token: "test-token" } };
  });
  await RendererAgent.createRun({ threadId: "a", configId: "c", content: "hello" });
  expect(mocks.request).toHaveBeenLastCalledWith({
    url: "/v1/threads/a/runs",
    method: "POST",
    data: { content: "hello" }
  });
  mocks.send.mockResolvedValueOnce({ ok: true, data: { keyword: "x".repeat(8192) } });
  await RendererAgent.createRun({ threadId: "a", configId: "c", content: "next" });
  expect(mocks.request).toHaveBeenLastCalledWith({
    url: "/v1/threads/a/runs",
    method: "POST",
    data: { content: "next" }
  });
});

it("删除模型配置调用 Rust 控制路由并编码配置 ID", async () => {
  mocks.request.mockResolvedValueOnce({ status: 204 });
  expect(await RendererAgent.deleteConfig("config/a")).toEqual({ ok: true, data: undefined });
  expect(mocks.request).toHaveBeenCalledExactlyOnceWith({
    url: "/v1/configs/config%2Fa",
    method: "DELETE"
  });
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

it("SDK 事件校验保留聊天用量细分、覆盖信息和辅助请求元数据", async () => {
  const events = [
    {
      type: "RUN_FINISHED",
      threadId: "t",
      runId: "r",
      result: "success",
      usages: {
        requests: 2,
        last_step: 2,
        records: [
          {
            step: 2,
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: 120,
              cached_tokens: 50,
              cache_write_tokens: 10,
              reasoning_tokens: 5
            }
          }
        ]
      }
    },
    {
      type: "CUSTOM",
      threadId: "t",
      runId: "r",
      name: "thread-metadata",
      value: {
        name: "对话标题",
        createdAt: 1,
        updatedAt: 2,
        auxiliaryUsage: {
          title: { requests: 1, reportedRequests: 1, promptTokens: 100, completionTokens: 10 },
          compaction: { requests: 1, reportedRequests: 0, promptTokens: 0, completionTokens: 0 }
        }
      }
    }
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
        )
      );
      controller.close();
    }
  });
  const received = [];
  for await (const value of decodeAgentEvents(stream as globalThis.ReadableStream<Uint8Array>))
    received.push(value);
  expect(received).toEqual(events);
});

it.each([
  "{invalid json}",
  JSON.stringify({ type: "UNKNOWN_EVENT", threadId: "t", runId: "r" }),
  JSON.stringify({
    type: "TEXT_MESSAGE_CONTENT",
    threadId: "t",
    runId: "r",
    messageId: "m",
    delta: 42
  })
])("拒绝损坏的事件并释放源流：%s", async (data) => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
    },
    cancel
  });
  const events = decodeAgentEvents(stream as globalThis.ReadableStream<Uint8Array>);

  await expect(events.next()).rejects.toBeInstanceOf(Error);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});

it("消费提前退出或预先取消时会释放 SDK 解码管道", async () => {
  for (const aborted of [false, true]) {
    const cancel = vi.fn();
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(source) {
        source.enqueue(
          new TextEncoder().encode('data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\n')
        );
      },
      cancel
    });
    if (aborted) controller.abort();
    const received = [];
    for await (const event of decodeAgentEvents(
      stream as globalThis.ReadableStream<Uint8Array>,
      controller.signal
    )) {
      received.push(event);
      break;
    }

    expect(received).toHaveLength(aborted ? 0 : 1);
    await vi.waitFor(() => {
      expect(cancel).toHaveBeenCalledOnce();
      expect(stream.locked).toBe(false);
    });
  }
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
