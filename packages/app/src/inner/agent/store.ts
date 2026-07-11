import { safeStorage } from "electron";
import { MainStoreForAgent } from "@/lib/key-value-store";
import {
  AIResult,
  type AIConversationStore,
  type AIProviderAPIKeyStore,
  type AIProviderConfigStore,
  type LLMConversationSnapshot,
  type AIProviderConfigSnapshot
} from "@mahiru/ai";

export class ConversationStore implements AIConversationStore {
  async remove(id: string): Promise<AIResult<void>> {
    try {
      const conversations = MainStoreForAgent.get("conversations", {});
      delete conversations[id];
      MainStoreForAgent.set("conversations", conversations);
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
      const conversations = MainStoreForAgent.get("conversations", {});
      conversations[snapshot.id] = structuredClone(snapshot);
      MainStoreForAgent.set("conversations", conversations);
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
      const conversations = MainStoreForAgent.get("conversations", {});
      return AIResult.ok(conversations[id]);
    } catch (error) {
      return AIResult.err({
        type: "conversation_storage",
        message: "读取会话失败",
        raw: error
      });
    }
  }

  async list(): Promise<AIResult<Pick<AIProviderConfigSnapshot, "id" | "name">[]>> {
    try {
      const conversations = MainStoreForAgent.get("conversations", {});
      return AIResult.ok(
        Object.values(conversations)
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
}

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
