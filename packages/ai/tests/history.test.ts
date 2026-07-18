import { z } from "zod";
import { AIResult } from "@/result";
import { LLMPromptBuilder } from "@/prompt";
import { LLMConversation } from "@/conversations";
import { LLMTool, LLMToolRegistry } from "@/tools";
import { LLMLoop, type LLMLoopEvent, type LLMLoopRunResult } from "@/loop";
import {
  LLMHistoryCompactor,
  partitionHistoryTurns,
  type LLMTokenEstimator,
  LLMConservativeTokenEstimator
} from "@/history";
import {
  LLMProvider,
  type LLMMessage,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider";
import type { LLMProviderConfig } from "@/provider/interface";

const signal = new AbortController().signal;

describe("保守 token 估算", () => {
  it("计入 assistant 工具调用携带的 providerContext", () => {
    const estimator = new LLMConservativeTokenEstimator();
    const providerContext = {
      provider: "openai.responses",
      data: {
        reasoningItems: [{ id: "reasoning-1", encrypted_content: "opaque-payload" }]
      }
    };
    const baseMessage: LLMMessage = {
      role: "assistant",
      toolCalls: [{ name: "search_music", callID: "call-1", arguments: "{}" }]
    };

    const withoutContext = estimator.estimateMessages([baseMessage]);
    const withContext = estimator.estimateMessages([{ ...baseMessage, providerContext }]);

    expect(withContext - withoutContext).toBe(
      estimator.estimateText(JSON.stringify(providerContext))
    );
  });
});

describe("history turn partition", () => {
  it("keeps an assistant tool call and all matching results in one turn", () => {
    const messages: LLMMessage[] = [
      { role: "user", content: "first" },
      {
        role: "assistant",
        toolCalls: [
          { name: "lookup", callID: "call-1", arguments: "{}" },
          { name: "lookup", callID: "call-2", arguments: "{}" }
        ]
      },
      { role: "tool", name: "lookup", callID: "call-1", content: "one" },
      { role: "tool", name: "lookup", callID: "call-2", content: "two" },
      { role: "assistant", content: "done" },
      { role: "user", content: "second" },
      { role: "assistant", content: "done again" }
    ];

    const result = partitionHistoryTurns(messages);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().map((turn) => turn.messages.length)).toEqual([5, 2]);
    expect(result.unwrap()[0]?.messages.slice(1, 4)).toEqual(messages.slice(1, 4));
  });
});

describe("LLMHistoryBudget", () => {
  it("百万上下文模型也会按软工作集上限压缩日常历史", async () => {
    const conversation = conversationWithTurns(6);
    const summaries: LLMGenerateRequest[] = [];
    const policy = {
      estimator: new FixedMessageEstimator(),
      defaultContextWindowTokens: 1_000_000,
      defaultMaxOutputTokens: 100,
      summaryMaxOutputTokens: 100,
      keepRecentTurns: 2,
      minRecentTurns: 1,
      triggerRatio: 0.8,
      targetRatio: 0.6,
      maxWorkingSetTokens: 17_000
    };
    const budget = new LLMHistoryCompactor(policy).createBudget({
      conversation,
      contextWindowTokens: 1_000_000,
      prefixMessages: [{ role: "system", content: "system-protected" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async (request) => {
        summaries.push(structuredClone(request));
        return AIResult.ok(response({ text: "soft-working-set-summary" }));
      }
    });

    const result = await budget.fit([{ role: "user", content: "current-protected" }]);

    expect(result.isOk()).toBe(true);
    expect(summaries).toHaveLength(1);
    expect(result.unwrap().request.messages[0]).toEqual({
      role: "system",
      content: "system-protected"
    });
    expect(result.unwrap().request.messages.at(-1)).toEqual({
      role: "user",
      content: "current-protected"
    });
    expect(result.unwrap().retainedTurnCount).toBe(2);
    expect(result.unwrap().estimatedInputTokens).toBeLessThanOrEqual(17_000);
  });

  it("软工作集上限不会裁剪当前轮或变成物理错误", async () => {
    const conversation = LLMConversation.create({ id: "soft-limit-current-turn" }).unwrap();
    const summaries: LLMGenerateRequest[] = [];
    const budget = new LLMHistoryCompactor({
      estimator: new FixedMessageEstimator(),
      defaultContextWindowTokens: 100_000,
      defaultMaxOutputTokens: 100,
      summaryMaxOutputTokens: 100,
      maxWorkingSetTokens: 2_000,
      triggerRatio: 0.8,
      targetRatio: 0.6
    }).createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system-protected" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async (request) => {
        summaries.push(structuredClone(request));
        return AIResult.ok(response({ text: "unused" }));
      }
    });

    const result = await budget.fit([{ role: "user", content: "large-current-turn" }]);

    expect(result.isOk()).toBe(true);
    expect(summaries).toHaveLength(0);
    expect(result.unwrap().estimatedInputTokens).toBeGreaterThan(2_000 * 0.8);
    expect(result.unwrap().request.messages).toEqual([
      { role: "system", content: "system-protected" },
      { role: "user", content: "large-current-turn" }
    ]);
  });

  it("大段 Responses 隐藏推理会触发历史压缩", async () => {
    const conversation = LLMConversation.create({ id: "provider-context-budget" }).unwrap();
    expect(conversation.appendMessage({ role: "user", content: "查找歌曲" }).isOk()).toBe(true);
    expect(
      conversation
        .appendMessage({
          role: "assistant",
          toolCalls: [{ name: "search_music", callID: "call-1", arguments: "{}" }],
          providerContext: {
            provider: "openai.responses",
            data: {
              reasoningItems: [{ id: "reasoning-1", encrypted_content: "x".repeat(20_000) }]
            }
          }
        })
        .isOk()
    ).toBe(true);
    expect(
      conversation
        .appendMessage({
          role: "tool",
          name: "search_music",
          callID: "call-1",
          content: "[]"
        })
        .isOk()
    ).toBe(true);
    expect(conversation.appendMessage({ role: "assistant", content: "没有结果" }).isOk()).toBe(
      true
    );
    appendTurns(conversation, 1, 2);

    const summaryRequests: LLMGenerateRequest[] = [];
    const budget = new LLMHistoryCompactor({
      estimator: new LLMConservativeTokenEstimator(),
      defaultContextWindowTokens: 15_000,
      defaultMaxOutputTokens: 500,
      summaryMaxOutputTokens: 200,
      keepRecentTurns: 1,
      minRecentTurns: 1,
      triggerRatio: 0.5,
      targetRatio: 0.3
    }).createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 500 },
      summarize: async (request) => {
        summaryRequests.push(structuredClone(request));
        return AIResult.ok(response({ text: "已压缩隐藏推理" }));
      }
    });

    const result = await budget.fit([{ role: "user", content: "继续" }]);

    expect(result.isOk()).toBe(true);
    expect(summaryRequests).toHaveLength(1);
    expect(result.unwrap().request.messages.some(isSummaryMessage)).toBe(true);
    expect(conversation.getCompaction()?.coveredMessageCount).toBeGreaterThanOrEqual(4);
  });

  it("summarizes old turns while preserving raw conversation and protected messages", async () => {
    const conversation = conversationWithTurns(6);
    const summaries: LLMGenerateRequest[] = [];
    const budget = createCompactor().createBudget({
      conversation,
      prefixMessages: [
        { role: "system", content: "system-protected" },
        { role: "system", content: "context-protected" }
      ],
      request: { signal, maxOutputTokens: 100 },
      summarize: async (request) => {
        summaries.push(structuredClone(request));
        return AIResult.ok(response({ text: `summary-${summaries.length}` }));
      }
    });
    const original = conversation.toMessages();

    const result = await budget.fit([{ role: "user", content: "current-protected" }]);

    expect(result.isOk()).toBe(true);
    const fitted = result.unwrap();
    expect(conversation.toMessages()).toEqual(original);
    expect(fitted.request.messages.slice(0, 2)).toEqual([
      { role: "system", content: "system-protected" },
      { role: "system", content: "context-protected" }
    ]);
    expect(fitted.request.messages.at(-1)).toEqual({
      role: "user",
      content: "current-protected"
    });
    expect(fitted.request.messages.some(isSummaryMessage)).toBe(true);
    expect(fitted.retainedTurnCount).toBe(2);
    expect(fitted.compactedMessageCount).toBe(8);
    expect(conversation.getCompaction()?.coveredMessageCount).toBe(8);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.tools).toBeUndefined();
  });

  it("reuses a cached summary and incrementally merges only newly evicted turns", async () => {
    const conversation = conversationWithTurns(6);
    const summaryRequests: LLMGenerateRequest[] = [];
    const budget = createCompactor().createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async (request) => {
        summaryRequests.push(structuredClone(request));
        return AIResult.ok(response({ text: `summary-${summaryRequests.length}` }));
      }
    });

    expect((await budget.fit([{ role: "user", content: "current" }])).isOk()).toBe(true);
    expect(summaryRequests).toHaveLength(1);

    expect((await budget.fit([{ role: "user", content: "current" }])).isOk()).toBe(true);
    expect(summaryRequests).toHaveLength(1);

    appendTurns(conversation, 6, 4);
    expect((await budget.fit([{ role: "user", content: "later" }])).isOk()).toBe(true);
    expect(summaryRequests).toHaveLength(2);
    expect(summaryRequests[1]?.messages.some(isSummaryMessage)).toBe(true);
    expect(conversation.getCompaction()?.coveredMessageCount).toBeGreaterThan(8);
  });

  it("falls back to a recent complete window when summary generation fails", async () => {
    const conversation = conversationWithTurns(6);
    let summaryCalls = 0;
    const budget = createCompactor().createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async () => {
        summaryCalls++;
        return AIResult.err({ type: "network", message: "offline" });
      }
    });

    const result = await budget.fit([{ role: "user", content: "current" }]);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().warnings[0]).toContain("offline");
    expect(
      result
        .unwrap()
        .request.messages.some(
          (message) =>
            message.role === "assistant" &&
            "content" in message &&
            typeof message.content === "string" &&
            message.content.includes("已从本轮上下文省略")
        )
    ).toBe(true);
    expect(result.unwrap().retainedTurnCount).toBe(2);
    expect(conversation.toMessages()).toHaveLength(12);
    expect(conversation.getCompaction()?.fallback).toMatchObject({
      attempt: 1,
      lastError: "offline"
    });

    const repeated = await budget.fit([{ role: "user", content: "current-again" }]);
    expect(repeated.isOk()).toBe(true);
    expect(summaryCalls).toBe(1);
  });

  it("按实际返回的回退请求重新估算并满足物理上限", async () => {
    const conversation = conversationWithTurns(6);
    const estimator = new FallbackShapeEstimator();
    const budget = new LLMHistoryCompactor({
      estimator,
      defaultContextWindowTokens: 11_100,
      defaultMaxOutputTokens: 100,
      summaryMaxOutputTokens: 100,
      keepRecentTurns: 2,
      minRecentTurns: 1,
      triggerRatio: 0.8,
      targetRatio: 0.6
    }).createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async () => AIResult.err({ type: "network", message: "offline" })
    });

    const result = await budget.fit([{ role: "user", content: "current" }]);

    expect(result.isOk()).toBe(true);
    const fitted = result.unwrap();
    expect(fitted.estimatedInputTokens).toBe(estimator.estimateRequest(fitted.request));
    expect(fitted.estimatedInputTokens).toBeLessThanOrEqual(6_904);
    expect(fitted.compactedMessageCount).toBe(10);
  });

  it("回退到期重试时保留旧摘要与覆盖状态并累计尝试次数", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T00:00:00.000Z"));

    try {
      const conversation = conversationWithTurns(6);
      const summaryRequests: LLMGenerateRequest[] = [];
      const budget = createCompactor().createBudget({
        conversation,
        prefixMessages: [{ role: "system", content: "system" }],
        request: { signal, maxOutputTokens: 100 },
        summarize: async (request) => {
          summaryRequests.push(structuredClone(request));
          if (summaryRequests.length === 1)
            return AIResult.ok(response({ text: "existing-summary" }));
          return AIResult.err({ type: "network", message: "offline" });
        }
      });

      expect((await budget.fit([{ role: "user", content: "first" }])).isOk()).toBe(true);
      const successfulState = structuredClone(conversation.getCompaction());
      expect(successfulState?.summary).toBe("existing-summary");

      appendTurns(conversation, 6, 4);
      expect((await budget.fit([{ role: "user", content: "second" }])).isOk()).toBe(true);
      const firstFallback = structuredClone(conversation.getCompaction());
      expect(firstFallback?.fallback?.attempt).toBe(1);
      expect(firstFallback?.fallback?.retryState).toMatchObject({
        summary: "existing-summary",
        coveredMessageCount: successfulState?.coveredMessageCount,
        coveredDigest: successfulState?.coveredDigest
      });

      vi.setSystemTime(firstFallback!.fallback!.retryAt);
      expect((await budget.fit([{ role: "user", content: "retry" }])).isOk()).toBe(true);

      expect(summaryRequests).toHaveLength(3);
      expect(summaryRequests[2]?.messages.some(isSummaryMessage)).toBe(true);
      expect(
        summaryRequests[2]?.messages.some(
          (message) =>
            message.role === "assistant" &&
            "content" in message &&
            message.content?.includes("existing-summary")
        )
      ).toBe(true);
      const secondFallback = conversation.getCompaction();
      expect(secondFallback?.summary).toContain("existing-summary");
      expect(secondFallback?.fallback?.attempt).toBe(2);
      expect(secondFallback?.fallback?.retryState).toEqual(firstFallback?.fallback?.retryState);
      expect(secondFallback!.fallback!.retryAt - firstFallback!.fallback!.retryAt).toBe(60_000);
      expect(successfulState?.coveredMessageCount).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it("旧版回退快照到期后从完整原始历史重新摘要", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T00:00:00.000Z"));

    try {
      const conversation = conversationWithTurns(6);
      const summaryRequests: LLMGenerateRequest[] = [];
      const budget = createCompactor().createBudget({
        conversation,
        prefixMessages: [{ role: "system", content: "system" }],
        request: { signal, maxOutputTokens: 100 },
        summarize: async (request) => {
          summaryRequests.push(structuredClone(request));
          return summaryRequests.length === 1
            ? AIResult.err({ type: "network", message: "offline" })
            : AIResult.ok(response({ text: "restored-summary" }));
        }
      });

      expect((await budget.fit([{ role: "user", content: "first" }])).isOk()).toBe(true);
      const legacyState = structuredClone(conversation.getCompaction())!;
      expect(legacyState.fallback?.retryState).toBeNull();
      if (legacyState.fallback) delete legacyState.fallback.retryState;
      conversation.setCompaction(legacyState);

      vi.setSystemTime(legacyState.fallback!.retryAt);
      expect((await budget.fit([{ role: "user", content: "retry" }])).isOk()).toBe(true);

      expect(summaryRequests).toHaveLength(2);
      expect(summaryRequests[1]?.messages).toContainEqual({ role: "user", content: "user-0" });
      expect(conversation.getCompaction()?.summary).toBe("restored-summary");
      expect(conversation.getCompaction()?.fallback).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a budget error instead of removing protected messages", async () => {
    const conversation = LLMConversation.create({ id: "protected-overflow" }).unwrap();
    const compactor = new LLMHistoryCompactor({
      estimator: new FixedMessageEstimator(),
      defaultContextWindowTokens: 7_000,
      defaultMaxOutputTokens: 100,
      summaryMaxOutputTokens: 100
    });
    const budget = compactor.createBudget({
      conversation,
      prefixMessages: [
        { role: "system", content: "system" },
        { role: "system", content: "context-1" },
        { role: "system", content: "context-2" }
      ],
      request: { signal, maxOutputTokens: 100 },
      summarize: async () => AIResult.ok(response({ text: "unused" }))
    });

    const result = await budget.fit([{ role: "user", content: "current" }]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.type).toBe("prompt_budget_exceeded");
  });

  it("accepts per-run context window and output reserve limits", async () => {
    const conversation = LLMConversation.create({ id: "runtime-limits" }).unwrap();
    const budget = createCompactor().createBudget({
      conversation,
      contextWindowTokens: 8_000,
      outputReserveTokens: 4_000,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async () => AIResult.ok(response({ text: "unused" }))
    });

    const result = await budget.fit([{ role: "user", content: "current" }]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.type).toBe("prompt_budget_exceeded");
  });

  it("clears persisted compaction state without clearing raw messages early", async () => {
    const conversation = conversationWithTurns(6);
    const budget = createCompactor().createBudget({
      conversation,
      prefixMessages: [{ role: "system", content: "system" }],
      request: { signal, maxOutputTokens: 100 },
      summarize: async () => AIResult.ok(response({ text: "summary" }))
    });
    expect((await budget.fit([{ role: "user", content: "current" }])).isOk()).toBe(true);

    const snapshot = conversation.snapshot();
    expect(snapshot.messages).toHaveLength(12);
    expect(snapshot.compaction).toBeDefined();

    const restored = LLMConversation.fromSnapshot(snapshot).unwrap();
    expect(restored.getCompaction()).toEqual(snapshot.compaction);
    restored.clear();
    expect(restored.toMessages()).toEqual([]);
    expect(restored.getCompaction()).toBeUndefined();
  });
});

describe("LLMLoop history re-budget", () => {
  it("re-budgets old history after a complete tool result group is appended", async () => {
    const provider = new HistoryLoopProvider([
      response({
        toolCalls: [{ name: "lookup", callID: "loop-call", arguments: "{}" }],
        finishReason: "tool_calls"
      }),
      response({ text: "final" })
    ]);
    const conversation = conversationWithTurns(2);
    const registry = new LLMToolRegistry();
    registry.register(new LookupTool());
    const builder = new LLMPromptBuilder("system", {
      estimator: new ToolHeavyEstimator(),
      defaultContextWindowTokens: 17_000,
      defaultMaxOutputTokens: 100,
      summaryMaxOutputTokens: 100,
      keepRecentTurns: 2,
      minRecentTurns: 1,
      triggerRatio: 0.8,
      targetRatio: 0.6
    });

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "current",
        provider,
        config: { model: "test", apiKey: "key", contextWindowTokens: 17_000 },
        promptBuilder: builder,
        tools: { registry, strict: true, choice: "auto" },
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.summaryRequests).toHaveLength(1);
    expect(provider.streamRequests[0]?.messages.some(isSummaryMessage)).toBe(false);
    expect(provider.streamRequests[1]?.messages.some(isSummaryMessage)).toBe(true);
    expect(provider.streamRequests[1]?.messages).toEqual(
      expect.arrayContaining([
        {
          role: "assistant",
          toolCalls: [{ name: "lookup", callID: "loop-call", arguments: "{}" }]
        },
        { role: "tool", name: "lookup", callID: "loop-call", content: "tool-output" }
      ])
    );
    expect(conversation.toMessages()).toHaveLength(4);
  });
});

class FixedMessageEstimator implements LLMTokenEstimator {
  estimateText(text: string): number {
    return text.length;
  }

  estimateMessages(messages: readonly LLMMessage[]): number {
    return messages.length * 1_000;
  }

  estimateRequest(request: LLMGenerateRequest): number {
    return this.estimateMessages(request.messages) + (request.tools?.length ?? 0) * 100;
  }
}

class ToolHeavyEstimator extends FixedMessageEstimator {
  override estimateMessages(messages: readonly LLMMessage[]): number {
    return messages.reduce((tokens, message) => {
      if (message.role === "tool") return tokens + 3_000;
      if (message.role === "assistant" && "toolCalls" in message) return tokens + 3_000;
      return tokens + 1_000;
    }, 0);
  }
}

class FallbackShapeEstimator extends FixedMessageEstimator {
  override estimateMessages(messages: readonly LLMMessage[]): number {
    return messages.reduce((tokens, message) => {
      if (
        message.role === "assistant" &&
        "content" in message &&
        message.content?.startsWith("[早期对话摘要") &&
        message.content.includes("已从本轮上下文省略")
      ) {
        return tokens + 2_800;
      }
      if (
        message.role === "assistant" &&
        "content" in message &&
        message.content?.startsWith("[由于暂时无法生成摘要")
      ) {
        return tokens + 100;
      }
      return tokens + 1_000;
    }, 0);
  }
}

function createCompactor() {
  return new LLMHistoryCompactor({
    estimator: new FixedMessageEstimator(),
    defaultContextWindowTokens: 17_000,
    defaultMaxOutputTokens: 100,
    summaryMaxOutputTokens: 100,
    keepRecentTurns: 2,
    minRecentTurns: 1,
    triggerRatio: 0.8,
    targetRatio: 0.6
  });
}

function conversationWithTurns(count: number) {
  const conversation = LLMConversation.create({ id: `conversation-${count}` }).unwrap();
  appendTurns(conversation, 0, count);
  return conversation;
}

function appendTurns(conversation: LLMConversation, start: number, count: number) {
  for (let index = start; index < start + count; index++) {
    expect(conversation.appendMessage({ role: "user", content: `user-${index}` }).isOk()).toBe(
      true
    );
    expect(
      conversation.appendMessage({ role: "assistant", content: `assistant-${index}` }).isOk()
    ).toBe(true);
  }
}

function isSummaryMessage(message: LLMMessage) {
  return (
    message.role === "assistant" &&
    "content" in message &&
    message.content?.startsWith("[早期对话摘要")
  );
}

function response(partial: Partial<LLMGenerateResponse>): LLMGenerateResponse {
  return {
    raw: {},
    text: "",
    usage: undefined,
    toolCalls: [],
    finishReason: "stop",
    ...partial
  };
}

async function collectRun(
  stream: AsyncGenerator<AIResult<LLMLoopEvent>, AIResult<LLMLoopRunResult>>
) {
  const events: LLMLoopEvent[] = [];
  while (true) {
    const next = await stream.next();
    if (next.done) return { events, result: next.value };
    if (next.value.isOk()) events.push(next.value.unwrap());
  }
}

class HistoryLoopProvider extends LLMProvider<LLMProviderConfig> {
  readonly summaryRequests: LLMGenerateRequest[] = [];
  readonly streamRequests: LLMGenerateRequest[] = [];
  private readonly responses: LLMGenerateResponse[];

  constructor(responses: LLMGenerateResponse[]) {
    super("history-loop");
    this.responses = [...responses];
  }

  override async check(config: LLMProviderConfig) {
    return AIResult.ok({ provider: this.name, model: config.model });
  }

  override async generate<T extends LLMProviderConfig>(_config: T, request: LLMGenerateRequest) {
    this.summaryRequests.push(structuredClone(request));
    return AIResult.ok(response({ text: `summary-${this.summaryRequests.length}` }));
  }

  override async *stream<T extends LLMProviderConfig>(
    _config: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    this.streamRequests.push(structuredClone(request));
    const next = this.responses.shift();
    if (!next) {
      yield AIResult.err({ type: "bad_response", message: "missing response" });
      return;
    }
    yield AIResult.ok({
      type: "done",
      text: next.text,
      raw: next.raw,
      usage: next.usage,
      toolCalls: next.toolCalls,
      finishReason: next.finishReason
    });
  }
}

const lookupSchema = z.object({});

class LookupTool extends LLMTool<typeof lookupSchema, string> {
  readonly inputSchema = lookupSchema;

  constructor() {
    super({ name: "lookup", description: "lookup" });
  }

  override async execute() {
    return AIResult.ok("tool-output");
  }
}
