import { AIResult } from "@/result";
import {
  validateMessage,
  validateMessages,
  collectToolCallIDs,
  collectPendingToolCalls
} from "@/utils/message";
import type { LLMToolCall } from "@/tools";
import type { LLMMessage } from "@/provider";

import type { LLMConversationSnapshot, LLMConversationCreateOptions } from "./types";

export class LLMConversation {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  private readonly metadata: Record<string, unknown>;
  private readonly messages: LLMMessage[];

  private constructor(snapshot: LLMConversationSnapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.metadata = { ...snapshot.metadata };
    this.messages = structuredClone(snapshot.messages);
  }

  private ensureNoPendingToolCalls(action: string): AIResult<void> {
    const pending = collectPendingToolCalls(this.messages);
    if (!pending.length) return AIResult.ok(undefined);

    return AIResult.err({
      type: "has_pending_tool_call",
      message: `${action} 前还有未写入结果的工具调用：${pending.map((call) => call.callID).join(", ")}`
    });
  }

  appendMessage(message: LLMMessage): AIResult<void> {
    const validateResult = validateMessage(message, collectToolCallIDs(this.messages));
    if (validateResult.isErr()) return validateResult;

    if (message.role === "tool") {
      const pending = collectPendingToolCalls(this.messages);
      const pendingCall = pending.find((call) => call.callID === message.callID);
      if (!pendingCall) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `没有对应的待完成的工具调用：${message.callID}`
        });
      }
      if (pendingCall.name !== message.name) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `工具调用与结果名称不匹配：${message.callID}`
        });
      }
    } else {
      const ready = this.ensureNoPendingToolCalls(`追加${message.role}消息`);
      if (ready.isErr()) return ready;
    }

    this.messages.push(structuredClone(message));
    return AIResult.ok(undefined);
  }

  snapshot(): LLMConversationSnapshot {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: { ...this.metadata },
      messages: structuredClone(this.messages)
    };
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  setMetadata(key: string, value: unknown) {
    this.metadata[key] = value;
  }

  toMessages(): LLMMessage[] {
    return structuredClone(this.messages);
  }

  pendingToolCalls(): LLMToolCall[] {
    return structuredClone(collectPendingToolCalls(this.messages));
  }

  clear() {
    this.messages.length = 0;
  }

  static create(options: LLMConversationCreateOptions): AIResult<LLMConversation> {
    if (!options.id.trim()) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation 缺少 id"
      });
    }

    const snapshot: LLMConversationSnapshot = {
      id: options.id,
      name: options.name ?? "",
      createdAt: options.createdAt ?? Date.now(),
      updatedAt: options.updatedAt ?? Date.now(),
      metadata: { ...(options.metadata ?? {}) },
      messages: options.messages ?? []
    };
    const validation = validateMessages(snapshot.messages);
    if (validation.isErr()) return validation;

    return AIResult.ok(new LLMConversation(snapshot));
  }

  static fromSnapshot(snapshot: LLMConversationSnapshot): AIResult<LLMConversation> {
    return LLMConversation.create(snapshot);
  }
}
