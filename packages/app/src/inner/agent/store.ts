import { safeStorage } from "electron";
import { createHash } from "node:crypto";
import { rm, readdir } from "node:fs/promises";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainStoreForAgent } from "@/lib/key-value-store";
import {
  AIResult,
  LLMConversation,
  type AIConversationStore,
  type AIProviderAPIKeyStore,
  type AIProviderConfigStore,
  type LLMConversationSnapshot,
  type AIProviderConfigSnapshot
} from "@mahiru/ai";
import ElectronStore from "electron-store";
import type { AgentConversationIndexEntry } from "@/lib/key-value-store";

const CONVERSATION_STORAGE_VERSION = 2;

type ConversationFile = {
  snapshot?: LLMConversationSnapshot;
};

export interface ConversationSnapshotStorage {
  remove(id: string): void | Promise<void>;
  write(snapshot: LLMConversationSnapshot): void | Promise<void>;
  list(): LLMConversationSnapshot[] | Promise<LLMConversationSnapshot[]>;
  read(id: string): Optional<LLMConversationSnapshot> | Promise<Optional<LLMConversationSnapshot>>;
}

class ElectronConversationSnapshotStorage implements ConversationSnapshotStorage {
  private readonly stores = new Map<string, ElectronStore<ConversationFile>>();
  private readonly directory = MainPathResolver.appUserDataJoin("key-value", "agent-conversations");

  async remove(id: string) {
    const store = this.getStore(id);
    this.stores.delete(id);
    await rm(store.path, { force: true });
  }

  write(snapshot: LLMConversationSnapshot) {
    this.getStore(snapshot.id).set("snapshot", structuredClone(snapshot));
  }

  read(id: string) {
    const snapshot = this.getStore(id).get("snapshot");
    return snapshot ? structuredClone(snapshot) : undefined;
  }

  async list() {
    let entries;
    try {
      entries = await readdir(this.directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const snapshots: LLMConversationSnapshot[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/^conversation-[a-f\d]{64}\.json$/i.test(entry.name)) continue;

      const storeName = entry.name.slice(0, -".json".length);
      try {
        const store = new ElectronStore<ConversationFile>({
          name: storeName,
          encryptionKey: process.env.APP_NAME,
          encryptionAlgorithm: "aes-256-cbc",
          cwd: this.directory
        });
        const snapshot = store.get("snapshot");
        if (!snapshot || storeName !== this.getStoreName(snapshot.id)) continue;
        this.stores.set(snapshot.id, store);
        snapshots.push(structuredClone(snapshot));
      } catch {
        // 单个损坏文件不能阻止其他会话恢复；原文件保留，便于后续人工排查。
      }
    }
    return snapshots;
  }

  private getStore(id: string) {
    const cached = this.stores.get(id);
    if (cached) return cached;
    const store = new ElectronStore<ConversationFile>({
      name: this.getStoreName(id),
      encryptionKey: process.env.APP_NAME,
      encryptionAlgorithm: "aes-256-cbc",
      cwd: this.directory
    });
    this.stores.set(id, store);
    return store;
  }

  private getStoreName(id: string) {
    const fileID = createHash("sha256").update(id).digest("hex");
    return `conversation-${fileID}`;
  }
}

export class ConversationStore implements AIConversationStore {
  private initializationTask: null | Promise<void> = null;

  constructor(
    private readonly snapshotStorage: ConversationSnapshotStorage = new ElectronConversationSnapshotStorage()
  ) {}

  async remove(id: string): Promise<AIResult<void>> {
    try {
      await this.ensureInitialized();
      await this.snapshotStorage.remove(id);
      const index = MainStoreForAgent.get("conversationIndex", {});
      if (id in index) {
        delete index[id];
        MainStoreForAgent.set("conversationIndex", index);
      }
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: "删除会话失败",
        raw: error
      });
    }
  }

  async write(snapshot: LLMConversationSnapshot): Promise<AIResult<void>> {
    try {
      await this.ensureInitialized();
      await this.snapshotStorage.write(structuredClone(snapshot));
      const index = MainStoreForAgent.get("conversationIndex", {});
      index[snapshot.id] = toConversationIndexEntry(snapshot);
      MainStoreForAgent.set("conversationIndex", index);
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: "写入会话失败",
        raw: error
      });
    }
  }

  async read(id: string): Promise<AIResult<Optional<LLMConversationSnapshot>>> {
    try {
      await this.ensureInitialized();
      const snapshot = await this.snapshotStorage.read(id);
      if (snapshot) this.repairIndex(snapshot);
      return AIResult.ok(snapshot);
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: "读取会话失败",
        raw: error
      });
    }
  }

  async list(): Promise<AIResult<Pick<LLMConversationSnapshot, "id" | "name">[]>> {
    try {
      await this.ensureInitialized();
      const index = MainStoreForAgent.get("conversationIndex", {});
      return AIResult.ok(
        Object.values(index)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(({ id, name }) => ({ id, name }))
      );
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: "读取会话列表失败",
        raw: error
      });
    }
  }

  private async ensureInitialized() {
    if (!this.initializationTask) {
      this.initializationTask = this.initialize().catch((error) => {
        this.initializationTask = null;
        throw error;
      });
    }
    await this.initializationTask;
  }

  private async initialize() {
    await this.migrateLegacyConversations();
    await this.reconcileIndex();
  }

  private async migrateLegacyConversations() {
    const version = MainStoreForAgent.get("conversationStorageVersion", 0);
    const legacy = MainStoreForAgent.get("conversations", {});
    // 即使版本号已提交，只要旧快照仍存在就重新迁移，以覆盖提交版本后清理旧数据前崩溃的情况。
    for (const snapshot of Object.values(legacy)) {
      await this.snapshotStorage.write(structuredClone(snapshot));
    }
    if (version < CONVERSATION_STORAGE_VERSION || Object.keys(legacy).length > 0) {
      MainStoreForAgent.set("conversationStorageVersion", CONVERSATION_STORAGE_VERSION);
    }
    if (MainStoreForAgent.has("conversations")) MainStoreForAgent.delete("conversations");
  }

  private async reconcileIndex() {
    const snapshots = await this.snapshotStorage.list();
    const reconciled: Record<string, AgentConversationIndexEntry> = {};
    for (const snapshot of snapshots) {
      if (!isValidConversationSnapshot(snapshot)) continue;
      const existing = reconciled[snapshot.id];
      if (!existing || snapshot.updatedAt >= existing.updatedAt) {
        reconciled[snapshot.id] = toConversationIndexEntry(snapshot);
      }
    }

    const current = MainStoreForAgent.get("conversationIndex", {});
    if (!conversationIndexesEqual(current, reconciled)) {
      // 快照文件是事实来源：补回孤儿快照，同时移除没有文件支撑的幽灵索引。
      MainStoreForAgent.set("conversationIndex", reconciled);
    }
  }

  private repairIndex(snapshot: LLMConversationSnapshot) {
    const index = MainStoreForAgent.get("conversationIndex", {});
    const entry = index[snapshot.id];
    if (
      entry?.name === snapshot.name &&
      entry.updatedAt === snapshot.updatedAt &&
      entry.id === snapshot.id
    ) {
      return;
    }
    index[snapshot.id] = toConversationIndexEntry(snapshot);
    MainStoreForAgent.set("conversationIndex", index);
  }
}

const toConversationIndexEntry = (
  snapshot: LLMConversationSnapshot
): AgentConversationIndexEntry => ({
  id: snapshot.id,
  name: snapshot.name,
  updatedAt: snapshot.updatedAt
});

const isValidConversationSnapshot = (value: unknown): value is LLMConversationSnapshot => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<LLMConversationSnapshot>;
  if (
    typeof snapshot.id !== "string" ||
    !snapshot.id.trim() ||
    typeof snapshot.name !== "string" ||
    !Number.isFinite(snapshot.createdAt) ||
    !Number.isFinite(snapshot.updatedAt) ||
    !Array.isArray(snapshot.messages) ||
    !snapshot.metadata ||
    typeof snapshot.metadata !== "object" ||
    Array.isArray(snapshot.metadata)
  ) {
    return false;
  }
  try {
    return LLMConversation.fromSnapshot(snapshot as LLMConversationSnapshot).isOk();
  } catch {
    return false;
  }
};

const conversationIndexesEqual = (
  left: Record<string, AgentConversationIndexEntry>,
  right: Record<string, AgentConversationIndexEntry>
) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((id) => {
    const a = left[id];
    const b = right[id];
    return a?.id === b?.id && a?.name === b?.name && a?.updatedAt === b?.updatedAt;
  });
};

export class ProviderAPIKeyStore implements AIProviderAPIKeyStore {
  async remove(configID: string): Promise<AIResult<void>> {
    try {
      const keys = MainStoreForAgent.get("providerAPIKeys", {});
      delete keys[configID];
      MainStoreForAgent.set("providerAPIKeys", keys);
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "删除 provider apiKey 失败",
        raw: error
      });
    }
  }

  async read(configID: string): Promise<AIResult<Optional<string>>> {
    try {
      const keys = MainStoreForAgent.get("providerAPIKeys", {});
      const encrypted = keys[configID];
      if (!encrypted) return AIResult.ok(undefined);
      if (!safeStorage.isEncryptionAvailable()) {
        return AIResult.err({
          type: "config_storage",
          message: "系统安全存储不可用，无法读取 provider apiKey"
        });
      }
      return AIResult.ok(safeStorage.decryptString(Buffer.from(encrypted, "base64")));
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "读取 provider apiKey 失败",
        raw: error
      });
    }
  }

  async write(configID: string, apiKey: string): Promise<AIResult<void>> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return AIResult.err({
          type: "config_storage",
          message: "系统安全存储不可用，无法保存 provider apiKey"
        });
      }

      const keys = MainStoreForAgent.get("providerAPIKeys", {});
      keys[configID] = safeStorage.encryptString(apiKey).toString("base64");
      MainStoreForAgent.set("providerAPIKeys", keys);
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "写入 provider apiKey 失败",
        raw: error
      });
    }
  }
}

export class ProviderConfigStore implements AIProviderConfigStore {
  async remove(id: string): Promise<AIResult<void>> {
    try {
      const configs = MainStoreForAgent.get("providerConfigs", {});
      delete configs[id];
      MainStoreForAgent.set("providerConfigs", configs);
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "删除 provider config 失败",
        raw: error
      });
    }
  }

  async list(): Promise<AIResult<AIProviderConfigSnapshot[]>> {
    try {
      const configs = MainStoreForAgent.get("providerConfigs", {});
      return AIResult.ok(Object.values(configs).sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "读取 provider config 列表失败",
        raw: error
      });
    }
  }

  async write(snapshot: AIProviderConfigSnapshot): Promise<AIResult<void>> {
    try {
      const configs = MainStoreForAgent.get("providerConfigs", {});
      configs[snapshot.id] = structuredClone(snapshot);
      MainStoreForAgent.set("providerConfigs", configs);
      return AIResult.ok(undefined);
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "写入 provider config 失败",
        raw: error
      });
    }
  }

  async read(id: string): Promise<AIResult<Optional<AIProviderConfigSnapshot>>> {
    try {
      const configs = MainStoreForAgent.get("providerConfigs", {});
      return AIResult.ok(configs[id]);
    } catch (error) {
      return AIResult.err({
        type: "config_storage",
        message: "读取 provider config 失败",
        raw: error
      });
    }
  }
}
