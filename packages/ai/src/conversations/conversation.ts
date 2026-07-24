import { AIResult } from "@/result";
import {
  validateMessage,
  validateMessages,
  collectToolCallIDs,
  collectPendingToolCalls
} from "@/utils/message";
import type { LLMToolCall } from "@/tools";
import type { LLMMessage } from "@/provider";
import type { LLMConversationCompactionSnapshot } from "@/history";

import type {
  LLMConversationSnapshot,
  LLMConversationCreateOptions,
  LLMConversationRuntimeSnapshot,
  LLMConversationAssistantTurnSnapshot
} from "./interface";

export class LLMConversation {
  readonly id: string;
  name: string;
  readonly createdAt: number;
  updatedAt: number;
  private readonly metadata: Record<string, unknown>;
  private readonly messages: LLMMessage[];
  private runtime?: LLMConversationRuntimeSnapshot;
  private compaction?: LLMConversationCompactionSnapshot;
  private readonly assistantTurns: LLMConversationAssistantTurnSnapshot[];

  private constructor(snapshot: LLMConversationSnapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name;
    this.createdAt = snapshot.createdAt;
    this.updatedAt = snapshot.updatedAt;
    this.metadata = { ...snapshot.metadata };
    this.messages = structuredClone(snapshot.messages);
    this.runtime = snapshot.runtime ? structuredClone(snapshot.runtime) : undefined;
    this.compaction = snapshot.compaction ? structuredClone(snapshot.compaction) : undefined;
    this.assistantTurns = structuredClone(snapshot.assistantTurns ?? []);
  }

  private touch() {
    this.updatedAt = Math.max(Date.now(), this.updatedAt + 1);
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
    this.touch();
    return AIResult.ok(undefined);
  }

  rename(name: string): AIResult<void> {
    const normalized = name.trim();
    if (!normalized) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation name 不能为空"
      });
    }

    this.name = normalized;
    this.touch();
    return AIResult.ok(undefined);
  }

  snapshot(): LLMConversationSnapshot {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: { ...this.metadata },
      messages: structuredClone(this.messages),
      ...(this.runtime ? { runtime: structuredClone(this.runtime) } : {}),
      ...(this.assistantTurns.length
        ? { assistantTurns: structuredClone(this.assistantTurns) }
        : {}),
      ...(this.compaction ? { compaction: structuredClone(this.compaction) } : {})
    };
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  setMetadata(key: string, value: unknown) {
    this.metadata[key] = value;
    this.touch();
  }

  toMessages(): LLMMessage[] {
    return structuredClone(this.messages);
  }

  getCompaction(): Undefinable<LLMConversationCompactionSnapshot> {
    return this.compaction ? structuredClone(this.compaction) : undefined;
  }

  setCompaction(state: Undefinable<LLMConversationCompactionSnapshot>) {
    this.compaction = state ? structuredClone(state) : undefined;
    this.touch();
  }

  getRuntime(): Undefinable<LLMConversationRuntimeSnapshot> {
    return this.runtime ? structuredClone(this.runtime) : undefined;
  }

  setRuntime(runtime: LLMConversationRuntimeSnapshot): AIResult<void> {
    const validation = LLMConversation.validateRuntime(runtime, this.messages);
    if (validation.isErr()) return validation;
    this.runtime = structuredClone(runtime);
    this.touch();
    return AIResult.ok(undefined);
  }

  getAssistantTurns(): LLMConversationAssistantTurnSnapshot[] {
    return structuredClone(this.assistantTurns);
  }

  recordAssistantTurn(turn: LLMConversationAssistantTurnSnapshot): AIResult<void> {
    const validation = LLMConversation.validateAssistantTurns(this.messages, [
      ...this.assistantTurns,
      turn
    ]);
    if (validation.isErr()) return validation;
    this.assistantTurns.push(structuredClone(turn));
    this.touch();
    return AIResult.ok(undefined);
  }

  updateAssistantTurn(
    messageIndex: number,
    update: Partial<Pick<LLMConversationAssistantTurnSnapshot, "usage" | "status" | "finishReason">>
  ): AIResult<void> {
    const index = this.assistantTurns.findIndex((turn) => turn.messageIndex === messageIndex);
    if (index < 0) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `assistant turn 元数据不存在：${messageIndex}`
      });
    }

    const next = this.assistantTurns.map((turn, turnIndex) =>
      turnIndex === index ? { ...turn, ...structuredClone(update) } : turn
    );
    const validation = LLMConversation.validateAssistantTurns(this.messages, next);
    if (validation.isErr()) return validation;
    this.assistantTurns[index] = next[index]!;
    this.touch();
    return AIResult.ok(undefined);
  }

  messageCount() {
    return this.messages.length;
  }

  pendingToolCalls(): LLMToolCall[] {
    return structuredClone(collectPendingToolCalls(this.messages));
  }

  rewindAbortedRun(
    expectedRunID: string,
    isToolRetrySafe: (toolName: string) => boolean = () => false
  ): AIResult<void> {
    const runID = expectedRunID.trim();
    const runtime = this.runtime;
    if (
      !runID ||
      !runtime ||
      runtime.runID !== runID ||
      runtime.status !== "aborted" ||
      !runtime.terminal ||
      !runtime.incomplete
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "只能回退会话最近一次已中止的运行"
      });
    }

    const inputMessageIndex = runtime.inputMessageIndex;
    if (
      inputMessageIndex === undefined ||
      !Number.isInteger(inputMessageIndex) ||
      inputMessageIndex < 0 ||
      this.messages[inputMessageIndex]?.role !== "user"
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "最近一次中止运行缺少可回退的用户消息位置"
      });
    }

    const turnByMessageIndex = new Map(
      this.assistantTurns.map((turn) => [turn.messageIndex, turn] as const)
    );
    const unsafeToolNames = new Set<string>();
    for (let index = inputMessageIndex + 1; index < this.messages.length; index++) {
      const message = this.messages[index];
      if (!message || (message.role !== "assistant" && message.role !== "tool")) {
        return AIResult.err({
          type: "invalid_conversation",
          message: "最近一次中止运行之后存在不属于该轮的消息"
        });
      }
      if (message.role === "assistant" && turnByMessageIndex.get(index)?.runID !== runID) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `中止运行的 assistant 元数据不一致：${index}`
        });
      }
      if (message.role === "assistant" && "toolCalls" in message) {
        for (const call of message.toolCalls) {
          if (!isToolRetrySafe(call.name)) unsafeToolNames.add(call.name);
        }
      }
    }

    if (
      this.assistantTurns.some(
        (turn) =>
          (turn.runID === runID && turn.messageIndex < inputMessageIndex) ||
          (turn.messageIndex >= inputMessageIndex && turn.runID !== runID)
      )
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "中止运行的 assistant turn 边界不一致"
      });
    }

    if (unsafeToolNames.size) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `中止运行包含不可安全重试的工具调用：${[...unsafeToolNames].join(", ")}`
      });
    }

    const retainedMessages = this.messages.slice(0, inputMessageIndex);
    const retainedValidation = validateMessages(retainedMessages);
    if (retainedValidation.isErr()) return retainedValidation;

    this.messages.splice(inputMessageIndex);
    for (let index = this.assistantTurns.length - 1; index >= 0; index--) {
      if (this.assistantTurns[index]!.messageIndex >= inputMessageIndex) {
        this.assistantTurns.splice(index, 1);
      }
    }
    if (runtime.titleGenerated) this.name = "";
    this.runtime = undefined;

    const retryCoveredMessageCount = this.compaction?.fallback?.retryState?.coveredMessageCount;
    if (
      this.compaction &&
      (this.compaction.coveredMessageCount > inputMessageIndex ||
        (retryCoveredMessageCount !== undefined && retryCoveredMessageCount > inputMessageIndex))
    ) {
      this.compaction = undefined;
    }
    this.touch();
    return AIResult.ok(undefined);
  }

  clear() {
    this.messages.length = 0;
    this.runtime = undefined;
    this.compaction = undefined;
    this.assistantTurns.length = 0;
    this.touch();
  }

  static create(options: LLMConversationCreateOptions): AIResult<LLMConversation> {
    if (!options.id.trim()) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation 缺少 id"
      });
    }

    const now = Date.now();
    const snapshot: LLMConversationSnapshot = {
      id: options.id,
      name: options.name ?? "",
      createdAt: now,
      updatedAt: now,
      metadata: { ...(options.metadata ?? {}) },
      messages: options.messages ?? [],
      ...(options.runtime ? { runtime: options.runtime } : {}),
      ...(options.assistantTurns ? { assistantTurns: options.assistantTurns } : {})
    };
    const validation = validateMessages(snapshot.messages);
    if (validation.isErr()) return validation;
    const runtimeValidation = snapshot.runtime
      ? LLMConversation.validateRuntime(snapshot.runtime, snapshot.messages)
      : AIResult.ok(undefined);
    if (runtimeValidation.isErr()) return runtimeValidation;
    const turnsValidation = LLMConversation.validateAssistantTurns(
      snapshot.messages,
      snapshot.assistantTurns ?? []
    );
    if (turnsValidation.isErr()) return turnsValidation;

    return AIResult.ok(new LLMConversation(snapshot));
  }

  static fromSnapshot(snapshot: LLMConversationSnapshot): AIResult<LLMConversation> {
    if (!snapshot.id.trim()) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation 缺少 id"
      });
    }

    const validation = validateMessages(snapshot.messages);
    if (validation.isErr()) return validation;
    const runtimeValidation = snapshot.runtime
      ? LLMConversation.validateRuntime(snapshot.runtime, snapshot.messages)
      : AIResult.ok(undefined);
    if (runtimeValidation.isErr()) return runtimeValidation;
    const turnsValidation = LLMConversation.validateAssistantTurns(
      snapshot.messages,
      snapshot.assistantTurns ?? []
    );
    if (turnsValidation.isErr()) return turnsValidation;

    return AIResult.ok(new LLMConversation(snapshot));
  }

  private static validateRuntime(
    runtime: LLMConversationRuntimeSnapshot,
    messages: readonly LLMMessage[]
  ): AIResult<void> {
    if (!runtime.runID.trim() || !Number.isFinite(runtime.startedAt)) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation runtime 缺少 runID 或 startedAt"
      });
    }
    const shouldBeTerminal = runtime.status !== "running" && runtime.status !== "idle";
    if (runtime.terminal !== shouldBeTerminal) {
      return AIResult.err({
        type: "invalid_conversation",
        message: `conversation runtime terminal 与状态不一致：${runtime.status}`
      });
    }
    if (runtime.terminal && !Number.isFinite(runtime.endedAt)) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "terminal conversation runtime 缺少 endedAt"
      });
    }
    if (!LLMConversation.isValidUsage(runtime.usage)) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation runtime usage 无效"
      });
    }
    if (runtime.titleGenerated !== undefined && typeof runtime.titleGenerated !== "boolean") {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation runtime titleGenerated 无效"
      });
    }
    if (
      runtime.inputMessageIndex !== undefined &&
      (!Number.isInteger(runtime.inputMessageIndex) ||
        runtime.inputMessageIndex < 0 ||
        runtime.inputMessageIndex >= messages.length ||
        messages[runtime.inputMessageIndex]?.role !== "user" ||
        messages.slice(runtime.inputMessageIndex + 1).some((message) => message.role === "user"))
    ) {
      return AIResult.err({
        type: "invalid_conversation",
        message: "conversation runtime inputMessageIndex 无效"
      });
    }
    return AIResult.ok(undefined);
  }

  private static validateAssistantTurns(
    messages: readonly LLMMessage[],
    turns: readonly LLMConversationAssistantTurnSnapshot[]
  ): AIResult<void> {
    const indexes = new Set<number>();
    for (const turn of turns) {
      const message = messages[turn.messageIndex];
      if (
        !turn.runID.trim() ||
        !Number.isInteger(turn.step) ||
        turn.step < 0 ||
        !Number.isInteger(turn.messageIndex) ||
        indexes.has(turn.messageIndex) ||
        message?.role !== "assistant"
      ) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `assistant turn 元数据无效：${turn.messageIndex}`
        });
      }
      indexes.add(turn.messageIndex);

      if (!LLMConversation.isValidUsage(turn.usage)) {
        return AIResult.err({
          type: "invalid_conversation",
          message: `assistant turn usage 无效：${turn.messageIndex}`
        });
      }
    }
    return AIResult.ok(undefined);
  }

  private static isValidUsage(usage: LLMConversationRuntimeSnapshot["usage"]): boolean {
    return Object.values(usage ?? {}).every(
      (value) => typeof value === "number" && Number.isFinite(value) && value >= 0
    );
  }
}
