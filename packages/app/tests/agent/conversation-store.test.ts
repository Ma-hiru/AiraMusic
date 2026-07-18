import type { LLMConversationSnapshot } from "@mahiru/ai";
import type { ConversationSnapshotStorage } from "@mahiru/app/inner/agent/store";

const mocks = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const set = vi.fn((key: string, value: unknown) => {
    values.set(key, structuredClone(value));
  });
  return {
    values,
    set,
    get: vi.fn((key: string, fallback?: unknown) =>
      values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback)
    ),
    has: vi.fn((key: string) => values.has(key)),
    delete: vi.fn((key: string) => values.delete(key))
  };
});

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

vi.mock("electron-store", () => ({
  default: class {}
}));

vi.mock("@mahiru/app/lib/path-resolver", () => ({
  MainPathResolver: { appUserDataJoin: vi.fn(() => "unused") }
}));

vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForAgent: {
    get: mocks.get,
    set: mocks.set,
    has: mocks.has,
    delete: mocks.delete
  }
}));

import { ConversationStore } from "@mahiru/app/inner/agent/store";

class MemoryConversationSnapshotStorage implements ConversationSnapshotStorage {
  readonly snapshots = new Map<string, LLMConversationSnapshot>();
  readonly writes: string[] = [];
  failWriteID = "";

  remove(id: string) {
    this.snapshots.delete(id);
  }

  write(snapshot: LLMConversationSnapshot) {
    this.writes.push(snapshot.id);
    if (snapshot.id === this.failWriteID) throw new Error(`write failed: ${snapshot.id}`);
    this.snapshots.set(snapshot.id, structuredClone(snapshot));
  }

  read(id: string) {
    const snapshot = this.snapshots.get(id);
    return snapshot ? structuredClone(snapshot) : undefined;
  }

  list() {
    return Array.from(this.snapshots.values(), (snapshot) => structuredClone(snapshot));
  }
}

const createSnapshot = (id: string, updatedAt: number): LLMConversationSnapshot => ({
  id,
  name: `会话 ${id}`,
  createdAt: 1,
  updatedAt,
  metadata: {},
  messages: [{ role: "user", content: `消息 ${id}` }]
});

describe("ConversationStore 独立快照存储", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.clear();
  });

  it("把旧版全量 conversations 安全迁移到逐会话快照和轻量索引", async () => {
    const first = createSnapshot("first", 10);
    const second = createSnapshot("second", 20);
    mocks.values.set("conversations", { first, second });
    const snapshots = new MemoryConversationSnapshotStorage();
    const store = new ConversationStore(snapshots);

    expect((await store.list()).unwrap()).toEqual([
      { id: "second", name: "会话 second" },
      { id: "first", name: "会话 first" }
    ]);
    expect(snapshots.snapshots.get("first")).toEqual(first);
    expect(snapshots.snapshots.get("second")).toEqual(second);
    expect(mocks.values.get("conversationStorageVersion")).toBe(2);
    expect(mocks.values.get("conversationIndex")).toEqual({
      first: { id: "first", name: "会话 first", updatedAt: 10 },
      second: { id: "second", name: "会话 second", updatedAt: 20 }
    });
    expect(mocks.values.has("conversations")).toBe(false);
  });

  it("迁移中途失败时保留旧数据，并能在下次调用中幂等重试", async () => {
    const first = createSnapshot("first", 10);
    const second = createSnapshot("second", 20);
    mocks.values.set("conversations", { first, second });
    const snapshots = new MemoryConversationSnapshotStorage();
    snapshots.failWriteID = "second";
    const store = new ConversationStore(snapshots);

    expect((await store.list()).isErr()).toBe(true);
    expect(mocks.values.has("conversations")).toBe(true);
    expect(mocks.values.has("conversationStorageVersion")).toBe(false);
    expect(snapshots.snapshots.get("first")).toEqual(first);

    snapshots.failWriteID = "";
    expect((await store.list()).unwrap()).toHaveLength(2);
    expect(snapshots.snapshots.get("second")).toEqual(second);
    expect(mocks.values.has("conversations")).toBe(false);
  });

  it("正常步骤只重写当前会话文件和轻量索引，不再回写全部会话", async () => {
    const first = createSnapshot("first", 10);
    const second = createSnapshot("second", 20);
    mocks.values.set("conversationStorageVersion", 2);
    mocks.values.set("conversationIndex", {
      first: { id: "first", name: first.name, updatedAt: first.updatedAt },
      second: { id: "second", name: second.name, updatedAt: second.updatedAt }
    });
    const snapshots = new MemoryConversationSnapshotStorage();
    snapshots.snapshots.set("first", first);
    snapshots.snapshots.set("second", second);
    const store = new ConversationStore(snapshots);
    const updated = {
      ...first,
      updatedAt: 30,
      messages: [...first.messages, { role: "assistant" as const, content: "新步骤" }]
    };

    expect((await store.write(updated)).isOk()).toBe(true);
    expect(snapshots.writes).toEqual(["first"]);
    expect(snapshots.snapshots.get("second")).toEqual(second);
    expect(mocks.set).toHaveBeenCalledWith(
      "conversationIndex",
      expect.objectContaining({
        first: { id: "first", name: first.name, updatedAt: 30 },
        second: { id: "second", name: second.name, updatedAt: 20 }
      })
    );
    expect(mocks.set).not.toHaveBeenCalledWith("conversations", expect.anything());
  });

  it("启动时补回孤儿快照并清除没有快照文件的幽灵索引", async () => {
    const orphan = createSnapshot("orphan", 30);
    mocks.values.set("conversationStorageVersion", 2);
    mocks.values.set("conversationIndex", {
      ghost: { id: "ghost", name: "幽灵会话", updatedAt: 40 }
    });
    const snapshots = new MemoryConversationSnapshotStorage();
    snapshots.snapshots.set("orphan", orphan);

    const store = new ConversationStore(snapshots);

    expect((await store.list()).unwrap()).toEqual([{ id: "orphan", name: "会话 orphan" }]);
    expect(mocks.values.get("conversationIndex")).toEqual({
      orphan: { id: "orphan", name: "会话 orphan", updatedAt: 30 }
    });
  });

  it("版本号已提交但旧快照仍在时继续完成迁移后再清理旧数据", async () => {
    const recovered = createSnapshot("recovered", 50);
    mocks.values.set("conversationStorageVersion", 2);
    mocks.values.set("conversations", { recovered });
    const snapshots = new MemoryConversationSnapshotStorage();

    const store = new ConversationStore(snapshots);

    expect((await store.read("recovered")).unwrap()).toEqual(recovered);
    expect(snapshots.snapshots.get("recovered")).toEqual(recovered);
    expect(mocks.values.has("conversations")).toBe(false);
  });
});
