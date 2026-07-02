import { AIResult } from "@/result";
import type { LLMToolCall } from "@/tools";
import type { LLMMessage } from "@/provider";

export function validateMessage(
  message: LLMMessage,
  seenToolCallIDs: Set<string>
): AIResult<LLMMessage> {
  if (message.role === "assistant" && "toolCalls" in message) {
    if (!message.toolCalls.length) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "缺少工具调用参数"
      });
    }

    for (const call of message.toolCalls) {
      if (!call.name || !call.callID) {
        return AIResult.err({
          type: "invalid_conversation",
          message: "工具调用缺少 name 或 callID"
        });
      }

      if (seenToolCallIDs.has(call.callID)) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `工具调用 id 重复：${call.callID}`
        });
      }

      seenToolCallIDs.add(call.callID);
    }

    return AIResult.ok(message);
  }
  if (message.role === "tool") {
    if (!message.name || !message.callID) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "工具结果缺少 name 或 callID"
      });
    }
    return AIResult.ok(message);
  }
  if (typeof message.content !== "string") {
    return AIResult.err({
      type: "invalid_conversation",
      message: `${message.role} message content 必须是字符串`
    });
  }
  return AIResult.ok(message);
}

export function validateMessages(messages: LLMMessage[]): AIResult<LLMMessage[]> {
  const pending = new Map<string, LLMToolCall>();
  const seenToolCallIDs = new Set<string>();

  for (const message of messages) {
    const validation = validateMessage(message, seenToolCallIDs);
    if (validation.isErr()) return validation;

    // 如果 assistant 消息中存在工具调用，则必须有对应的工具调用结果，且工具调用结果必须在 assistant 消息之后
    if (message.role !== "tool" && pending.size > 0) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `工具调用结果未补齐：${Array.from(pending.keys()).join(", ")}`
      });
    }

    if (message.role === "assistant" && "toolCalls" in message) {
      for (const call of message.toolCalls) pending.set(call.callID, call);
    } else if (message.role === "tool") {
      const call = pending.get(message.callID);
      if (!call) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `存在孤立的工具调用：${message.callID}`
        });
      }
      if (call.name !== message.name) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `工具调用与实际结果名称不匹配：${message.callID}`
        });
      }
      pending.delete(message.callID);
    }
  }

  return AIResult.ok(messages);
}

export function collectToolCallIDs(messages: LLMMessage[]): Set<string> {
  const ids = new Set<string>();

  for (const message of messages) {
    if (message.role === "assistant" && "toolCalls" in message) {
      for (const call of message.toolCalls) ids.add(call.callID);
    }
  }

  return ids;
}

export function collectPendingToolCalls(messages: LLMMessage[]): LLMToolCall[] {
  const pending = new Map<string, LLMToolCall>();

  for (const message of messages) {
    if (message.role === "assistant" && "toolCalls" in message) {
      for (const call of message.toolCalls) pending.set(call.callID, call);
    } else if (message.role === "tool") {
      pending.delete(message.callID);
    }
  }

  return Array.from(pending.values());
}
