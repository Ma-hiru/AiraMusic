import type { ProviderConfigView } from "@mahiru/agent";
import type { InvokeEventArgs } from "@mahiru/ipc/types";

const { frame, sender, createRun, getWindowID, createConfig, updateConfig, fromWebContents } =
  vi.hoisted(() => {
    const frame = { url: "http://localhost:5173/agent.html" };
    const sender = { mainFrame: frame };
    const senderWindow = {};
    return {
      frame,
      sender,
      createRun: vi.fn(),
      createConfig: vi.fn(),
      updateConfig: vi.fn(),
      fromWebContents: vi.fn(() => senderWindow),
      getWindowID: vi.fn(() => "agent")
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
vi.mock("@mahiru/app/services/agent", () => ({
  MainAgent: {
    createRun,
    createConfig,
    updateConfig,
    broadcastFeatureSettings: vi.fn()
  }
}));
vi.mock("@mahiru/app/inner/mcp/runtime", () => ({
  MainMcp: { shutdown: vi.fn() }
}));
vi.mock("@mahiru/app/services/agent/settings", () => ({
  MainAgentFeatureSettings: { getState: vi.fn(), update: vi.fn() }
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

describe("Rust Agent IPC 转发", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("直接转发生成的 ProviderConfigInput 并返回脱敏视图", async () => {
    const config = providerInput();
    const options = {
      id: "config-1",
      config
    } satisfies InvokeEventArgs<"invoke_agent_update_config">;
    const snapshot = {
      ...config,
      id: "config-1",
      maskedApiKey: "sk-***"
    } satisfies ProviderConfigView;
    updateConfig.mockResolvedValue(snapshot);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_update_config(
      { sender, senderFrame: frame } as never,
      options
    );

    expect(updateConfig).toHaveBeenCalledWith("config-1", config);
    expect(result).toEqual({ ok: true, data: snapshot });
  });

  it("直接转发 thread/config/content 创建 Rust run", async () => {
    const input = {
      threadId: "thread-1",
      configId: "config-1",
      content: "介绍当前歌曲"
    } satisfies InvokeEventArgs<"invoke_agent_create_run">;
    createRun.mockResolvedValue({ threadId: "thread-1", runId: "run-1" });

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_create_run(
      { sender, senderFrame: frame } as never,
      input
    );

    expect(createRun).toHaveBeenCalledWith("thread-1", "config-1", "介绍当前歌曲");
    expect(result).toEqual({
      ok: true,
      data: { threadId: "thread-1", runId: "run-1" }
    });
  });

  it("拒绝 Agent 窗口 iframe 和外部 origin", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const iframeResult = await invokeHandlers.invoke_agent_create_config(
      { sender, senderFrame: { url: frame.url } } as never,
      providerInput()
    );
    expect(iframeResult).toMatchObject({ ok: false, reason: { code: "auth" } });

    const foreignFrame = { url: "http://localhost:9999/agent.html" };
    const foreignResult = await invokeHandlers.invoke_agent_create_config(
      { sender: { mainFrame: foreignFrame }, senderFrame: foreignFrame } as never,
      providerInput()
    );
    expect(foreignResult).toMatchObject({ ok: false, reason: { code: "auth" } });
    expect(createConfig).not.toHaveBeenCalled();
  });
});

const providerInput = () => ({
  name: "OpenAI",
  provider: "openai",
  model: "gpt-5",
  apiKey: "sk-secret",
  contextSize: "128K",
  default: true,
  thinking: false
});
