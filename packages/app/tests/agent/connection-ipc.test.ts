const mocks = vi.hoisted(() => {
  const frame = { url: "http://localhost:5173/agent.html" };
  return {
    frame,
    sender: { mainFrame: frame },
    getConnection: vi.fn(() => ({ endpoint: "http://127.0.0.1:34567", token: "control-token" })),
    getWindowID: vi.fn(() => "agent"),
    initialize: vi.fn(),
    fromWebContents: vi.fn(() => ({}))
  };
});
vi.mock("electron", () => ({
  app: {},
  dialog: {},
  BrowserWindow: { fromWebContents: mocks.fromWebContents }
}));
vi.mock("@mahiru/app/lib/log", () => ({
  Log: { error: vi.fn(), warn: vi.fn() },
  runWithLogContext: <T>(_context: unknown, callback: () => T): T => callback()
}));
vi.mock("@mahiru/app/lib/handle", () => ({
  MainHandle: {
    get: () => ({ agent: { getConnection: mocks.getConnection, init: mocks.initialize } })
  }
}));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: {} }));
vi.mock("@mahiru/app/utils/merge", () => ({ mergeCacheStoreConfig: vi.fn() }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: {
    getId: mocks.getWindowID,
    getAppFrameURL: vi.fn(() => "http://localhost:5173/agent.html")
  }
}));
vi.mock("@mahiru/app/lib/screen-resolver", () => ({ MainScreenResolver: {} }));
vi.mock("@mahiru/app/constants/store", () => ({ MainCacheStoreConstants: {} }));
vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForConfig: {},
  MainStoreForRenderer: {}
}));

import { invokeHandlers } from "@mahiru/app/inner/ipc/invoke";
const authorized = () => ({ sender: mocks.sender, senderFrame: mocks.frame }) as never;

describe("Agent 连接配置 IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWindowID.mockReturnValue("agent");
    mocks.getConnection.mockReturnValue({
      endpoint: "http://127.0.0.1:34567",
      token: "control-token"
    });
  });

  it("仅向合法 Agent 主框架返回当前服务连接", async () => {
    await expect(invokeHandlers.invoke_agent_connection(authorized(), undefined)).resolves.toEqual({
      ok: true,
      data: { endpoint: "http://127.0.0.1:34567", token: "control-token" }
    });
    expect(mocks.getConnection).toHaveBeenCalledOnce();
    expect(mocks.initialize).not.toHaveBeenCalled();
  });

  it("拒绝 iframe、其他 origin 和主窗口获取凭证", async () => {
    const iframe = await invokeHandlers.invoke_agent_connection(
      { sender: mocks.sender, senderFrame: { ...mocks.frame } } as never,
      undefined
    );
    expect(iframe).toMatchObject({ ok: false, reason: { code: "auth" } });
    const foreign = { url: "http://localhost:9999/agent.html" };
    const result = await invokeHandlers.invoke_agent_connection(
      { sender: { mainFrame: foreign }, senderFrame: foreign } as never,
      undefined
    );
    expect(result).toMatchObject({ ok: false, reason: { code: "auth" } });
    mocks.getWindowID.mockReturnValue("main");
    expect(await invokeHandlers.invoke_agent_connection(authorized(), undefined)).toMatchObject({
      ok: false,
      reason: { code: "auth" }
    });
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("未启用或服务未就绪时不隐式启动", async () => {
    for (const message of ["Agent 本次启动未运行；请重启应用", "Agent 服务尚未就绪"]) {
      mocks.getConnection.mockImplementationOnce(() => {
        throw new Error(message);
      });
      expect(await invokeHandlers.invoke_agent_connection(authorized(), undefined)).toMatchObject({
        ok: false,
        reason: { message }
      });
    }
    expect(mocks.initialize).not.toHaveBeenCalled();
  });

  it("控制面转发处理器已移除", () => {
    for (const name of [
      "invoke_agent_list_threads",
      "invoke_agent_create_run",
      "invoke_agent_cancel_run",
      "invoke_agent_list_configs",
      "invoke_agent_update_config"
    ]) {
      expect(invokeHandlers).not.toHaveProperty(name);
    }
  });
});
