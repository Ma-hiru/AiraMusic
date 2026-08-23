import { randomBytes } from "node:crypto";
import { safeStorage } from "electron";
import { MainStoreForAgent } from "@/lib/key-value-store";

const AgentStoreSecretKey = "agentStoreSecret";

/** 返回稳定的 Rust Agent 存储密钥；持久层中只保存系统安全存储密文。 */
export function getAgentStoreSecret(): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("系统安全存储不可用，无法启动 Agent 加密存储");
  }

  const encrypted = MainStoreForAgent.get(AgentStoreSecretKey);
  if (encrypted) {
    const secret = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    if (!secret) throw new Error("Agent 加密存储密钥为空");
    return secret;
  }

  const secret = randomBytes(32).toString("base64url");
  const ciphertext = safeStorage.encryptString(secret).toString("base64");
  MainStoreForAgent.set(AgentStoreSecretKey, ciphertext);
  return secret;
}
