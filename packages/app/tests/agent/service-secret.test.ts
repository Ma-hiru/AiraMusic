import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  return {
    values,
    available: vi.fn(() => true),
    encrypt: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decrypt: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/, "")),
    get: vi.fn((key: string) => values.get(key)),
    set: vi.fn((key: string, value: unknown) => values.set(key, value))
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
  MainStoreForAgent: { get: mocks.get, set: mocks.set }
}));

import { getAgentStoreSecret } from "../../src/services/agent/secret";

describe("Rust Agent store secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.clear();
    mocks.available.mockReturnValue(true);
  });

  it("只持久化 safeStorage 密文并在后续启动复用明文", () => {
    const first = getAgentStoreSecret();
    const persisted = mocks.values.get("agentStoreSecret");

    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(persisted).toBe(Buffer.from(`encrypted:${first}`).toString("base64"));
    expect(String(persisted)).not.toContain(first);

    const second = getAgentStoreSecret();
    expect(second).toBe(first);
    expect(mocks.encrypt).toHaveBeenCalledOnce();
    expect(mocks.decrypt).toHaveBeenCalledOnce();
  });

  it("系统安全存储不可用时拒绝生成可丢失或明文密钥", () => {
    mocks.available.mockReturnValue(false);
    expect(() => getAgentStoreSecret()).toThrow("系统安全存储不可用");
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
