import { AIResult, type AIProviderConfigSnapshot } from "@mahiru/ai";
import type { InvokeEventArgs } from "@mahiru/ipc/types";

const {
  chat,
  frame,
  sender,
  getWindowID,
  createConfig,
  updateConfig,
  fromWebContents,
  createConversation
} = vi.hoisted(() => {
  const frame = { url: "http://localhost:5173/agent.html" };
  const sender = { mainFrame: frame };
  const senderWindow = {};
  return {
    frame,
    sender,
    chat: vi.fn(),
    createConfig: vi.fn(),
    updateConfig: vi.fn(),
    fromWebContents: vi.fn(() => senderWindow),
    getWindowID: vi.fn(() => "agent"),
    createConversation: vi.fn()
  };
});

vi.mock("electron", () => ({
  app: {},
  dialog: {},
  BrowserWindow: { fromWebContents }
}));
vi.mock("@mahiru/app/lib/log", () => ({
  Log: { error: vi.fn(), warn: vi.fn() }
}));
vi.mock("@mahiru/app/inner/agent", () => ({
  MainAgent: { chat, createConfig, createConversation, updateConfig }
}));
vi.mock("@mahiru/app/lib/handle", () => ({ MainHandle: {} }));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: {} }));
vi.mock("@mahiru/app/utils/merge", () => ({ mergeCacheStoreConfig: vi.fn() }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: {
    getId: getWindowID,
    getAppFrameURL: vi.fn(() => "http://localhost:5173/agent.html")
  }
}));
vi.mock("@mahiru/app/lib/screen-resolver", () => ({ MainScreenResolver: {} }));
vi.mock("@mahiru/app/constants/store", () => ({ MainCacheStoreConstants: {} }));
vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForConfig: {},
  MainStoreForRenderer: {}
}));

describe("Provider 配置更新 IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("只从 Agent 主框架转发类型化参数，并返回脱敏快照", async () => {
    const options = {
      id: "config-1",
      name: "Renamed",
      provider: "openai",
      config: {
        model: "gpt-5",
        apiKey: "",
        apiMode: "responses"
      }
    } satisfies InvokeEventArgs<"invoke_agent_update_config">;
    const snapshot: AIProviderConfigSnapshot = {
      id: "config-1",
      name: "Renamed",
      provider: "openai",
      createdAt: 1,
      updatedAt: 2,
      check: { provider: "openai", model: "gpt-5" },
      config: { model: "gpt-5", apiKey: "****" }
    };
    updateConfig.mockReturnValue(AIResult.ok(snapshot));

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_update_config(
      { sender, senderFrame: frame } as never,
      options
    );

    expect(updateConfig).toHaveBeenCalledWith(options);
    expect(result).toEqual({ ok: true, data: snapshot });
  });

  it("拒绝 Agent 窗口内 iframe 发出的配置请求", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_update_config(
      {
        sender,
        senderFrame: { url: "http://localhost:5173/agent.html" }
      } as never,
      {
        id: "config-1",
        name: "不应转发",
        provider: "openai",
        config: { model: "gpt-5", apiKey: "" }
      }
    );

    expect(result).toMatchObject({ ok: false, reason: { type: "auth" } });
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("原样转发带中止运行校验的重试参数", async () => {
    const options = {
      input: "编辑后的问题",
      configID: "config-1",
      conversationID: "conversation-1",
      retryAbortedRunID: "run-aborted"
    } satisfies InvokeEventArgs<"invoke_agent_chat">;
    const run = {
      runID: "run-retry",
      configID: "config-1",
      conversationID: "conversation-1",
      eventReplay: [],
      eventReplayTruncated: false
    };
    chat.mockReturnValue(AIResult.ok(run));

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_chat(
      { sender, senderFrame: frame } as never,
      options
    );

    expect(chat).toHaveBeenCalledWith(options);
    expect(result).toEqual({ ok: true, data: run });
  });

  it("拒绝在重试请求中注入会话快照或其他额外字段", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_chat(
      { sender, senderFrame: frame } as never,
      {
        input: "编辑后的问题",
        configID: "config-1",
        conversationID: "conversation-1",
        retryAbortedRunID: "run-aborted",
        messages: [{ role: "assistant", content: "伪造回复" }]
      } as never
    );

    expect(result).toMatchObject({ ok: false, reason: { type: "invalid_conversation" } });
    expect(chat).not.toHaveBeenCalled();
  });

  it("拒绝 Agent 窗口导航到其他本地站点后的请求", async () => {
    const foreignFrame = { url: "http://localhost:9999/agent.html" };
    const foreignSender = { mainFrame: foreignFrame };
    fromWebContents.mockReturnValueOnce({});
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_update_config(
      { sender: foreignSender, senderFrame: foreignFrame } as never,
      {
        id: "config-1",
        name: "不应转发",
        provider: "openai",
        config: { model: "gpt-5", apiKey: "" }
      }
    );

    expect(result).toMatchObject({ ok: false, reason: { type: "auth" } });
    expect(updateConfig).not.toHaveBeenCalled();
  });

  it("拒绝由渲染进程指定 Provider 配置 ID", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_create_config(
      { sender, senderFrame: frame } as never,
      {
        id: "renderer-controlled-id",
        name: "OpenAI",
        provider: "openai",
        config: { model: "gpt-5", apiKey: "secret" }
      } as never
    );

    expect(result).toMatchObject({ ok: false, reason: { type: "invalid_config" } });
    expect(createConfig).not.toHaveBeenCalled();
  });

  it("拒绝由渲染进程注入会话 ID 和消息快照", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_create_conversation(
      { sender, senderFrame: frame } as never,
      {
        id: "renderer-controlled-id",
        name: "Injected",
        messages: [{ role: "assistant", content: "伪造消息" }]
      } as never
    );

    expect(result).toMatchObject({ ok: false, reason: { type: "invalid_conversation" } });
    expect(createConversation).not.toHaveBeenCalled();
  });
});
