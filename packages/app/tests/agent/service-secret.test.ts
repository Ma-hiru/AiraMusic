import { it, vi, expect, describe, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  return {
    values,
    available: vi.fn(() => true),
    encrypt: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decrypt: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/, "")),
    get: vi.fn((key: string) => values.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value);
    }),
    agentStoreSecrets: [] as string[],
    panic: vi.fn()
  };
});

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: mocks.available,
    encryptString: mocks.encrypt,
    decryptString: mocks.decrypt
  }
}));

vi.mock("../../src/lib/key-value-store", () => ({
  MainStoreForAgent: { get: mocks.get, set: mocks.set },
  MainStoreForConfig: { get: vi.fn(), set: vi.fn() }
}));

vi.mock("../../src/lib/log", () => ({
  Log: {
    EnvLevel: 2,
    debug: vi.fn(),
    error: vi.fn(),
    format: (title: string, err: unknown) =>
      `${title}: ${err instanceof Error ? err.message : String(err)}`
  },
  runWithLogContext: <T>(_context: unknown, callback: () => T) => callback()
}));

vi.mock("../../src/lib/runtime", () => ({
  MainRuntime: {
    agentControlToken: "control-token",
    agentMcpToken: "mcp-token",
    isDev: false
  }
}));

vi.mock("../../src/inner/agent/mcp", () => ({
  MainAgentMcp: { endpoint: { url: "http://127.0.0.1:32123/mcp" } }
}));

vi.mock("../../src/lib/path-resolver", () => ({
  MainPathResolver: {
    agentBinaryPath: "/app/agent",
    agentDataDir: "/data/agent",
    appUserDataJoin: (name: string) => `/data/${name}`
  }
}));

vi.mock("../../src/lib/port", () => ({
  MainPortResolver: {
    resolve: vi.fn(async () => 10_001),
    candidates: vi.fn(() => []),
    parse: vi.fn(() => undefined)
  }
}));

vi.mock("../../src/services/agent", () => ({
  default: class {
    readonly name = "agent";

    constructor(options: { storeSecret: string }) {
      mocks.agentStoreSecrets.push(options.storeSecret);
    }

    async ready() {}

    async stop() {}
  }
}));

vi.mock("../../src/services/ncm", () => ({ default: class {} }));
vi.mock("../../src/services/proxy", () => ({ default: class {} }));
vi.mock("../../src/services/store", () => ({ default: class {} }));

import { MainServices } from "../../src/services";

/** 通过真实的 Agent 服务创建流程取回本次启动使用的存储密钥 */
async function startAgent() {
  const services = new MainServices({ services: [], onPanic: mocks.panic });
  await services.startService("agent");
  return mocks.agentStoreSecrets.at(-1)!;
}

describe("Rust Agent store secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.clear();
    mocks.agentStoreSecrets.length = 0;
    mocks.available.mockReturnValue(true);
  });

  it("只持久化 safeStorage 密文并在后续启动复用明文", async () => {
    const first = await startAgent();
    const persisted = mocks.values.get("agentStoreSecret");

    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(persisted).toBe(Buffer.from(`encrypted:${first}`).toString("base64"));
    expect(String(persisted)).not.toContain(first);

    const second = await startAgent();
    expect(second).toBe(first);
    expect(mocks.encrypt).toHaveBeenCalledOnce();
    expect(mocks.decrypt).toHaveBeenCalledOnce();
  });

  it("系统安全存储不可用时拒绝生成可丢失或明文密钥", async () => {
    mocks.available.mockReturnValue(false);
    await expect(startAgent()).rejects.toThrow("agent service create failed");
    expect(mocks.panic).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: expect.stringContaining("系统安全存储不可用") })
    );
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.encrypt).not.toHaveBeenCalled();
    expect(mocks.agentStoreSecrets).toHaveLength(0);
  });
});
