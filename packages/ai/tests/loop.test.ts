import { z } from "zod";
import { AIResult } from "@/result";
import { createLog } from "@mahiru/log";
import { LLMPromptBuilder } from "@/prompt";
import { LLMContextComposer } from "@/context";
import { LLMConversation } from "@/conversations";
import { LLMTool, LLMToolRegistry, type LLMToolContext } from "@/tools";
import { LLMLoop, type LLMLoopEvent, type LLMLoopRunResult } from "@/loop";
import {
  LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider";
import type { AIInject } from "@/inject";
import type { LLMProviderConfig } from "@/provider/interface";

type TestConfig = LLMProviderConfig;

const signal = new AbortController().signal;
const searchCall = {
  name: "search_music",
  callID: "call_1",
  arguments: JSON.stringify({ keyword: "Aira" })
};

const baseInject = {
  Log: createLog("TRACE"),
  CreateID: () => "id",
  ConversationStore: {
    list: async () => AIResult.ok([]),
    remove: async () => AIResult.ok(undefined),
    write: async () => AIResult.ok(undefined),
    read: async () => AIResult.ok(undefined)
  },
  ProviderConfigStore: {
    list: async () => AIResult.ok([]),
    remove: async () => AIResult.ok(undefined),
    write: async () => AIResult.ok(undefined),
    read: async () => AIResult.ok(undefined)
  },
  ProviderAPIKeyStore: {
    remove: async () => AIResult.ok(undefined),
    write: async () => AIResult.ok(undefined),
    read: async () => AIResult.ok(undefined)
  }
} satisfies AIInject;

describe("LLMLoop", () => {
  it("yields text deltas and final messages without mutating conversation", async () => {
    const provider = new FakeProvider([response({ text: "你好，我是 Aira" })]);
    const conversation = LLMConversation.create({ id: "conversation-1" }).unwrap();

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "你好",
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder("你是音乐助手"),
        maxSteps: 1
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(run.result.unwrap().response.text).toBe("你好，我是 Aira");
    expect(run.result.unwrap().messages).toEqual([
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好，我是 Aira" }
    ]);
    expect(conversation.toMessages()).toEqual([]);
    expect(provider.requests[0]?.messages).toEqual([
      { role: "system", content: "你是音乐助手" },
      { role: "user", content: "你好" }
    ]);
    expect(provider.generateRequests).toHaveLength(0);
    expect(run.events).toEqual([
      { type: "text_delta", step: 0, text: "你好，我是 Aira" },
      {
        type: "done",
        step: 0,
        messages: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好，我是 Aira" }
        ],
        response: {
          text: "你好，我是 Aira",
          usage: undefined,
          toolCalls: [],
          finishReason: "stop"
        }
      }
    ]);
  });

  it("yields provider errors without committing messages", async () => {
    const provider = new FakeProvider([]);
    const conversation = LLMConversation.create({ id: "conversation-provider-error" }).unwrap();

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "你好",
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 1
      })
    );

    expect(run.result.isErr()).toBe(true);
    if (run.result.isErr()) expect(run.result.reason.type).toBe("bad_response");
    expect(run.errors).toHaveLength(1);
    expect(run.events).toEqual([]);
    expect(conversation.toMessages()).toEqual([]);
    expect(provider.requests[0]?.messages).toEqual([{ role: "user", content: "你好" }]);
    expect(provider.generateRequests).toHaveLength(0);
  });

  it("applies the final-text validator to the done event and returned messages", async () => {
    const provider = new FakeProvider([response({ text: "原始回复" })]);
    const conversation = LLMConversation.create({ id: "final-text-transform" }).unwrap();

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "你好",
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 1,
        transformFinalText: ({ text, messages }) => {
          expect(messages).toEqual([{ role: "user", content: "你好" }]);
          return `${text}（已校验）`;
        }
      })
    );

    expect(run.result.unwrap().response.text).toBe("原始回复（已校验）");
    expect(run.result.unwrap().messages.at(-1)).toEqual({
      role: "assistant",
      content: "原始回复（已校验）"
    });
    expect(run.events.at(-1)).toMatchObject({
      type: "done",
      response: { text: "原始回复（已校验）" }
    });
  });

  it("marks streamed drafts for discard when final-text validation throws", async () => {
    const usage = { inputTokens: 10, outputTokens: 4, totalTokens: 14 };
    const observedUsage: unknown[] = [];
    const provider = new FakeProvider([response({ text: "未经校验的回复", usage })]);
    const conversation = LLMConversation.create({ id: "final-text-transform-error" }).unwrap();

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "你好",
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 1,
        onUsage: (value) => observedUsage.push(value),
        transformFinalText: () => {
          throw new Error("validator failed");
        }
      })
    );

    expect(run.result.isErr()).toBe(true);
    expect(run.events).toEqual([{ type: "text_delta", step: 0, text: "未经校验的回复" }]);
    expect(run.errors[0]?.raw).toMatchObject({ discardPartialText: true });
    expect(observedUsage).toEqual([usage]);
  });

  it("yields tool calls, tool results, and continues generation", async () => {
    const provider = new FakeProvider([
      response({ text: "", toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "找到 Aira" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-2" }).unwrap();

    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder("你是音乐助手"),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    const result = run.result.unwrap();
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.toolResults[0]?.output).toBe('["Aira"]');
    expect(result.messages).toEqual([
      { role: "user", content: "找 Aira" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' },
      { role: "assistant", content: "找到 Aira" }
    ]);
    expect(conversation.toMessages()).toEqual([]);
    expect(provider.requests[1]?.messages).toEqual([
      { role: "system", content: "你是音乐助手" },
      { role: "user", content: "找 Aira" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' }
    ]);
    expect(provider.generateRequests).toHaveLength(0);
    expect(run.events).toEqual([
      {
        type: "tool_call",
        step: 0,
        usage: undefined,
        finishReason: "tool_calls",
        toolCalls: [searchCall],
        message: { role: "assistant", toolCalls: [searchCall] }
      },
      {
        type: "tool_result",
        step: 0,
        messages: [
          { role: "user", content: "找 Aira" },
          { role: "assistant", toolCalls: [searchCall] },
          { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' }
        ],
        toolResults: [{ name: "search_music", callID: "call_1", raw: ["Aira"], output: '["Aira"]' }]
      },
      { type: "text_delta", step: 1, text: "找到 Aira" },
      {
        type: "done",
        step: 1,
        messages: [
          { role: "user", content: "找 Aira" },
          { role: "assistant", toolCalls: [searchCall] },
          { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' },
          { role: "assistant", content: "找到 Aira" }
        ],
        response: {
          text: "找到 Aira",
          usage: undefined,
          toolCalls: [],
          finishReason: "stop"
        }
      }
    ]);
  });

  it("延迟工具只在目录工具授权后进入后续请求", async () => {
    const directoryCall = {
      name: "tool_directory",
      callID: "directory_1",
      arguments: "{}"
    };
    const provider = new FakeProvider([
      response({ toolCalls: [directoryCall], finishReason: "tool_calls" }),
      response({ text: "已加载所需能力" })
    ]);
    const conversation = LLMConversation.create({ id: "deferred-tools" }).unwrap();
    const registry = new LLMToolRegistry();
    registry
      .register([new DeferredToolDirectory(), new DeferredReadTool(), new ForbiddenWriteTool()])
      .unwrap();

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "查找能力",
        tools: {
          registry,
          strict: true,
          choice: "auto",
          selectedNames: ["tool_directory"],
          activatableNames: ["deferred_read"]
        },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests[0]?.tools?.map((tool) => tool.name)).toEqual(["tool_directory"]);
    expect(provider.requests[1]?.tools?.map((tool) => tool.name)).toEqual([
      "tool_directory",
      "deferred_read"
    ]);
  });

  it("每个模型步骤独立限制工具输出，后续分页不会被前一步耗尽", async () => {
    const firstCall = { name: "large_output", callID: "large-1", arguments: "{}" };
    const secondCall = { name: "large_output", callID: "large-2", arguments: "{}" };
    const provider = new FakeProvider([
      response({ toolCalls: [firstCall], finishReason: "tool_calls" }),
      response({ toolCalls: [secondCall], finishReason: "tool_calls" }),
      response({ text: "已根据有限结果完成。" })
    ]);
    const conversation = LLMConversation.create({ id: "tool-output-run-budget" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new LargeOutputTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "连续读取大结果",
        tools: {
          registry,
          strict: true,
          choice: "auto",
          maxTotalOutputChars: 600
        },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isOk()).toBe(true);
    const toolMessages = run.result.unwrap().messages.filter((message) => message.role === "tool");
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages.every((message) => message.content.length <= 600)).toBe(true);
    expect(
      toolMessages.reduce((total, message) => total + message.content.length, 0)
    ).toBeLessThanOrEqual(1_200);
    expect(toolMessages[0]?.content).toContain("工具结果已裁剪");
    expect(toolMessages[1]?.content).toContain("工具结果已裁剪");
  });

  it("后续步骤按滑动预算重放工具结果，同时保留完整持久化消息", async () => {
    const calls = [1, 2, 3].map((index) => ({
      name: "large_output",
      callID: `window-${index}`,
      arguments: "{}"
    }));
    const provider = new FakeProvider([
      ...calls.map((call) => response({ toolCalls: [call], finishReason: "tool_calls" })),
      response({ text: "已综合最近结果完成。" })
    ]);
    const conversation = LLMConversation.create({ id: "tool-output-sliding-window" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new LargeOutputTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "连续读取三次大结果",
        tools: {
          registry,
          strict: true,
          choice: "auto",
          maxRetainedToolOutputChars: 2_700
        },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 4
      })
    );

    expect(run.result.isOk()).toBe(true);
    const finalRequestTools = provider.requests[3]!.messages.filter(
      (message) => message.role === "tool"
    );
    expect(
      finalRequestTools.reduce((total, message) => total + message.content.length, 0)
    ).toBeLessThanOrEqual(2_700);
    expect(finalRequestTools[0]?.content).toContain("pruned");
    expect(finalRequestTools.at(-1)?.content.length).toBeGreaterThan(1_500);

    const persistedTools = run.result
      .unwrap()
      .messages.filter((message) => message.role === "tool");
    expect(persistedTools).toHaveLength(3);
    expect(persistedTools.every((message) => message.content.length === 2_000)).toBe(true);
  });

  it("forwards provider context across a tool step without interpreting it", async () => {
    const providerContext = {
      provider: "test.provider",
      data: { opaque: ["reasoning-item"] }
    };
    const provider = new FakeProvider([
      response({
        providerContext,
        toolCalls: [searchCall],
        finishReason: "tool_calls"
      }),
      response({ text: "找到 Aira" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-provider-context" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests[1]?.messages).toContainEqual({
      role: "assistant",
      toolCalls: [searchCall],
      providerContext
    });
    expect(run.result.unwrap().messages).toContainEqual({
      role: "assistant",
      toolCalls: [searchCall],
      providerContext
    });
  });

  it("turns tool execution failures into tool result messages", async () => {
    const provider = new FakeProvider([
      response({
        toolCalls: [{ ...searchCall, name: "missing_tool" }],
        finishReason: "tool_calls"
      }),
      response({ text: "工具不可用" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-3" }).unwrap();

    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    const toolMessage = run.result.unwrap().messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain("unknown_tool");
    expect(conversation.toMessages()).toEqual([]);
    expect(provider.generateRequests).toHaveLength(0);
    expect(run.events.some((event) => event.type === "tool_result")).toBe(true);
  });

  it("把动态路由失配标记为仅内部可见的工具结果", async () => {
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "改用本轮能力继续回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "internal-tool-routing" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "继续",
        tools: { registry, strict: true, choice: "auto", selectedNames: [] },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    const toolMessage = run.result.unwrap().messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain('"visibility":"internal"');
    expect(toolMessage?.content).not.toContain("本轮未启用");
    expect(toolMessage?.content).not.toContain('"call"');
    expect(toolMessage?.content.length).toBeLessThan(180);
  });

  it("keeps request-only dynamic context in later tool steps", async () => {
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "找到了" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-dynamic-context" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());
    const context = new LLMContextComposer({
      inject: baseInject,
      sources: [
        {
          name: "player",
          async load() {
            return AIResult.ok([{ key: "track", content: "当前歌曲：动态 A" }]);
          }
        }
      ]
    });

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "搜索相似歌曲",
        instructions: ['<active_skill id="recommend">使用真实相似歌曲</active_skill>'],
        tools: { registry, strict: true, choice: "auto" },
        context: { composer: context, placement: "before_user", defaultRole: "user" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder("稳定系统提示", {}),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests[1]?.messages).toEqual([
      { role: "system", content: "稳定系统提示" },
      {
        role: "system",
        content: '<active_skill id="recommend">使用真实相似歌曲</active_skill>'
      },
      { role: "user", content: "[track]\n当前歌曲：动态 A" },
      { role: "user", content: "搜索相似歌曲" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' }
    ]);
    expect(
      run.result.unwrap().messages.some((message) => message.content?.includes("动态 A"))
    ).toBe(false);
  });

  it("hides premature answers and enforces required Skill evidence once", async () => {
    const discardedUsage = { inputTokens: 20, outputTokens: 8, totalTokens: 28 };
    const observedUsage: unknown[] = [];
    const provider = new FakeProvider([
      response({ text: "我先凭记忆回答。", usage: discardedUsage }),
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "根据真实搜索结果回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "required-evidence-loop" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索真实歌曲资料",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Aira" }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder("你是音乐助手"),
        maxSteps: 3,
        onUsage: (usage) => observedUsage.push(usage)
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(run.events.some((event) => event.type === "text_delta" && event.step === 0)).toBe(false);
    expect(run.events.map((event) => event.type)).toEqual([
      "tool_call",
      "tool_result",
      "text_delta",
      "done"
    ]);
    expect(provider.requests[0]?.toolChoice).toBe("required");
    expect(provider.requests[1]?.toolChoice).toBe("required");
    expect(provider.requests[1]?.messages.at(-1)).toMatchObject({
      role: "system",
      content: expect.stringContaining("搜索真实歌曲资料")
    });
    expect(provider.requests[2]?.toolChoice).toBe("none");
    expect(observedUsage).toEqual([discardedUsage]);
    expect(run.result.unwrap().messages).toEqual([
      { role: "user", content: "介绍 Aira" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' },
      { role: "assistant", content: "根据真实搜索结果回答。" }
    ]);
  });

  it("在 auto-only Provider 上提前提示必要取证，避免丢弃完整回答", async () => {
    const provider = new AutoOnlyProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "根据真实结果回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "auto-only-required-evidence" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索真实歌曲资料",
            toolNames: ["search_music"]
          }
        ],
        provider,
        config: { model: "legacy-model", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual(["auto", "none"]);
    expect(provider.requests[0]?.messages.at(-1)).toMatchObject({
      role: "system",
      content: expect.stringContaining("搜索真实歌曲资料")
    });
    expect(run.events.map((event) => event.type)).toEqual([
      "tool_call",
      "tool_result",
      "text_delta",
      "done"
    ]);
  });

  it("keeps tool choice required until every evidence item is satisfied", async () => {
    const secondSearchCall = {
      name: "search_music",
      arguments: JSON.stringify({ keyword: "Bira" }),
      callID: "call_2"
    };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [secondSearchCall], finishReason: "tool_calls" }),
      response({ text: "两项证据均已读取。" })
    ]);
    const conversation = LLMConversation.create({ id: "required-evidence-progress" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "比较 Aira 和 Bira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "compare:aira",
            description: "搜索 Aira",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Aira" }
          },
          {
            id: "compare:bira",
            description: "搜索 Bira",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Bira" }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "required",
      "required",
      "none"
    ]);
  });

  it("allows an attempted evidence source to fail and then explains the gap", async () => {
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "搜索服务暂时不可用，无法核实这部分资料。" })
    ]);
    const conversation = LLMConversation.create({ id: "attempted-evidence-failure" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new FailingSearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "尝试搜索真实歌曲资料",
            toolNames: ["search_music"],
            satisfaction: "attempt"
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual(["required", "none"]);
    expect(provider.requests[1]?.messages.at(-1)).toMatchObject({
      role: "tool",
      content: expect.stringContaining("搜索服务不可用")
    });
  });

  it("skips dependent evidence when its prerequisite attempt fails", async () => {
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "搜索失败，因此没有可安全打开的结果。" })
    ]);
    const conversation = LLMConversation.create({ id: "dependent-evidence-failure" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new FailingSearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索网页",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Aira" },
            satisfaction: "attempt"
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "opened-result" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"]
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual(["required", "none"]);
  });

  it("does not skip dependent evidence while a success requirement is retried", async () => {
    const retryCall = {
      ...searchCall,
      callID: "call_retry"
    };
    const openCall = {
      name: "search_music",
      callID: "call_open",
      arguments: JSON.stringify({ keyword: "opened-result" })
    };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [retryCall], finishReason: "tool_calls" }),
      response({ toolCalls: [openCall], finishReason: "tool_calls" }),
      response({ text: "重试成功后读取了正文。" })
    ]);
    const conversation = LLMConversation.create({ id: "retry-evidence-dependency" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new FlakySearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "成功搜索网页",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Aira" }
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "opened-result" },
            dependsOn: ["overview:search"]
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 4
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "required",
      "required",
      "required",
      "none"
    ]);
  });

  it("does not count invalid tool arguments as a real evidence attempt", async () => {
    const invalidCall = {
      name: "search_music",
      callID: "call_invalid",
      arguments: '{"keyword":'
    };
    const provider = new FakeProvider([
      response({ toolCalls: [invalidCall], finishReason: "tool_calls" }),
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "使用有效参数完成了搜索。" })
    ]);
    const conversation = LLMConversation.create({ id: "invalid-evidence-attempt" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "尝试搜索歌曲资料",
            toolNames: ["search_music"],
            satisfaction: "attempt"
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "required",
      "required",
      "none"
    ]);
  });

  it("reactivates dependent evidence after an attempted source later succeeds", async () => {
    const retryCall = {
      ...searchCall,
      callID: "call_attempt_retry"
    };
    const openCall = {
      name: "search_music",
      callID: "call_attempt_open",
      arguments: JSON.stringify({ keyword: "opened-result" })
    };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [retryCall], finishReason: "tool_calls" }),
      response({ toolCalls: [openCall], finishReason: "tool_calls" }),
      response({ text: "重试成功后继续读取了正文。" })
    ]);
    const conversation = LLMConversation.create({ id: "retry-attempted-dependency" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new FlakySearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "尝试搜索网页",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "Aira" },
            satisfaction: "attempt"
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["search_music"],
            argumentEquals: { keyword: "opened-result" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"]
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 4
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "required",
      "auto",
      "required",
      "none"
    ]);
  });

  it("只接受真实出现在前置证据结果中的后续工具参数", async () => {
    const trustedURL = "https://trusted.test/article?a=1&b=2";
    const searchResultURL = "https://trusted.test/article/?b=2&a=1#source";
    const secondSearchURL = "https://trusted.test/second";
    const searchPageURL = "https://search.test/?q=Aira";
    const provider = new FakeProvider([
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_source_search",
            arguments: JSON.stringify({ action: "search", query: "Aira" })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_source_search_second",
            arguments: JSON.stringify({ action: "search", query: "second" })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_arbitrary_open",
            arguments: JSON.stringify({
              action: "open",
              url: searchPageURL
            })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_grounded_open",
            arguments: JSON.stringify({ action: "open", url: trustedURL })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({ text: "只使用搜索结果中的链接完成了取证。" })
    ]);
    const conversation = LLMConversation.create({ id: "evidence-result-reference" }).unwrap();
    const registry = new LLMToolRegistry({ maxOutputChars: 512 });
    registry.register(new EvidenceBrowserTool(searchResultURL, searchPageURL, secondSearchURL));

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索可信网页",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "search" }
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "open" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"],
            argumentFromEvidence: {
              argumentName: "url",
              evidenceID: "overview:search",
              outputPath: ["results", "url"]
            }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 5
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "required",
      "required",
      "required",
      "required",
      "none"
    ]);
  });

  it("搜索成功但没有候选链接时把 attempt 证据降级为不可用并跳过依赖项", async () => {
    const provider = new FakeProvider([
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_empty_search",
            arguments: JSON.stringify({ action: "search", query: "empty" })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({ text: "没有找到可打开的候选页面，我会明确说明资料缺口。" })
    ]);
    const conversation = LLMConversation.create({ id: "empty-evidence-results" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new EvidenceBrowserTool("https://trusted.test/article"));

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索可信网页",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "search" },
            satisfaction: "attempt"
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "open" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"],
            argumentFromEvidence: {
              argumentName: "url",
              evidenceID: "overview:search",
              outputPath: ["results", "url"]
            }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual(["required", "none"]);
    expect(run.events.filter((event) => event.type === "tool_result")).toHaveLength(1);
  });

  it("连续工具调用没有推进必要证据时提前熔断，而不是耗尽最大步骤", async () => {
    const searchCalls = ["first", "second", "third", "fourth"].map((query, index) => ({
      name: "evidence_browser",
      callID: `call_no_progress_${index + 1}`,
      arguments: JSON.stringify({ action: "search", query })
    }));
    const provider = new FakeProvider([
      ...searchCalls.map((call) => response({ toolCalls: [call], finishReason: "tool_calls" })),
      response({ text: "根据已有搜索结果回答，并说明没有成功打开正文。" })
    ]);
    const conversation = LLMConversation.create({ id: "evidence-no-progress" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new EvidenceBrowserTool("https://trusted.test/article"));

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索可信网页",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "search" },
            satisfaction: "attempt"
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "open" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"],
            argumentFromEvidence: {
              argumentName: "url",
              evidenceID: "overview:search",
              outputPath: ["results", "url"]
            }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 8
      })
    );

    expect(run.result.isErr()).toBe(true);
    if (run.result.isErr()) {
      expect(run.result.reason.type).toBe("bad_response");
      expect(run.result.reason.message).toContain("打开搜索结果");
    }
    expect(provider.requests).toHaveLength(4);
    expect(run.errors.at(-1)?.type).toBe("bad_response");
  });

  it("放宽停滞预算后允许更多换词尝试，打开正文后正常完成", async () => {
    const searchCalls = ["first", "second", "third", "fourth", "fifth"].map((query, index) => ({
      name: "evidence_browser",
      callID: `call_retry_${index + 1}`,
      arguments: JSON.stringify({ action: "search", query })
    }));
    const provider = new FakeProvider([
      ...searchCalls.map((call) => response({ toolCalls: [call], finishReason: "tool_calls" })),
      response({
        toolCalls: [
          {
            name: "evidence_browser",
            callID: "call_retry_open",
            arguments: JSON.stringify({ action: "open", url: "https://trusted.test/article" })
          }
        ],
        finishReason: "tool_calls"
      }),
      response({ text: "根据搜索与正文回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "evidence-no-progress-budget" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new EvidenceBrowserTool("https://trusted.test/article"));

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索可信网页",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "search" },
            satisfaction: "attempt"
          },
          {
            id: "overview:open",
            description: "打开搜索结果",
            toolNames: ["evidence_browser"],
            argumentEquals: { action: "open" },
            satisfaction: "attempt",
            dependsOn: ["overview:search"],
            argumentFromEvidence: {
              argumentName: "url",
              evidenceID: "overview:search",
              outputPath: ["results", "url"]
            }
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 10,
        // 默认 3 步预算会在第四次请求前熔断；放宽到 6 后 5 次换词重搜仍可用
        maxNoEvidenceProgressSteps: 6
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests).toHaveLength(7);
  });

  it("fails when the model ignores the evidence correction twice", async () => {
    const provider = new FakeProvider([
      response({ text: "第一次提前回答" }),
      response({ text: "第二次仍然提前回答" })
    ]);
    const conversation = LLMConversation.create({ id: "ignored-required-evidence" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "介绍 Aira",
        tools: { registry, strict: true, choice: "auto" },
        requiredEvidence: [
          {
            id: "overview:search",
            description: "搜索真实歌曲资料",
            toolNames: ["search_music"]
          }
        ],
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isErr()).toBe(true);
    if (run.result.isErr()) {
      expect(run.result.reason.type).toBe("bad_response");
      expect(run.result.reason.message).toContain("搜索真实歌曲资料");
    }
    expect(run.events).toEqual([]);
    expect(run.errors).toHaveLength(1);
  });

  it("runs contiguous read-only calls in parallel and action calls sequentially", async () => {
    const calls = ["read_1", "read_2", "action_1", "action_2"].map((name, index) => ({
      name,
      arguments: "{}",
      callID: `call_${index + 1}`
    }));
    const provider = new FakeProvider([
      response({ toolCalls: calls, finishReason: "tool_calls" }),
      response({ text: "完成" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-parallel-tools" }).unwrap();
    const readTracker = { active: 0, maxActive: 0 };
    const actionTracker = { active: 0, maxActive: 0 };
    const registry = new LLMToolRegistry({ parallelSafeNames: ["read_1", "read_2"] });
    registry.register([
      new TrackedTool("read_1", readTracker),
      new TrackedTool("read_2", readTracker),
      new TrackedTool("action_1", actionTracker),
      new TrackedTool("action_2", actionTracker)
    ]);

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "执行工具",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 2
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(readTracker.maxActive).toBe(2);
    expect(actionTracker.maxActive).toBe(1);
    expect(run.result.unwrap().steps[0]?.toolResults.map((result) => result.name)).toEqual([
      "read_1",
      "read_2",
      "action_1",
      "action_2"
    ]);
  });

  it("does not retry a side-effect tool after its commit status becomes unknown", async () => {
    const firstCall = { name: "side_effect", callID: "side-1", arguments: "{}" };
    const retryCall = { name: "side_effect", callID: "side-2", arguments: "{}" };
    const provider = new FakeProvider([
      response({ toolCalls: [firstCall], finishReason: "tool_calls" }),
      response({ toolCalls: [retryCall], finishReason: "tool_calls" }),
      response({ text: "提交状态无法确认，请先核验。" })
    ]);
    const conversation = LLMConversation.create({ id: "commit-unknown" }).unwrap();
    const tool = new CommitUnknownTool();
    const registry = new LLMToolRegistry();
    registry.register(tool);

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "执行一次写操作",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(tool.executeCount).toBe(1);
    const outputs = run.result
      .unwrap()
      .steps.flatMap((step) => step.toolResults.map((result) => result.output));
    expect(outputs).toHaveLength(2);
    expect(outputs.every((output) => output.includes("commit_unknown"))).toBe(true);
  });

  it("在最后一个模型步骤关闭工具调用，为已有证据保留最终回答机会", async () => {
    const secondCall = { ...searchCall, callID: "call_last_step_second" };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [secondCall], finishReason: "tool_calls" }),
      response({ text: "基于已经取得的结果回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "reserve-final-step" }).unwrap();
    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 3
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "auto",
      "auto",
      "none"
    ]);
  });

  it("相同只读调用在一轮内复用结果，并停止继续调用工具", async () => {
    const duplicateCall = { ...searchCall, callID: "call_duplicate_read" };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [duplicateCall], finishReason: "tool_calls" }),
      response({ text: "使用第一次搜索结果回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "deduplicate-read-call" }).unwrap();
    const registry = new LLMToolRegistry({ reuseSafeNames: ["search_music"] });
    const tool = new CountingSearchMusicTool();
    registry.register(tool);

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 4
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(tool.executeCount).toBe(1);
    expect(provider.requests.map((request) => request.toolChoice)).toEqual([
      "auto",
      "auto",
      "none"
    ]);
  });

  it("动作工具执行后清空只读复用缓存，避免返回变更前状态", async () => {
    const actionCall = { name: "action", callID: "call_cache_action", arguments: "{}" };
    const repeatedRead = { ...searchCall, callID: "call_read_after_action" };
    const provider = new FakeProvider([
      response({ toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ toolCalls: [actionCall], finishReason: "tool_calls" }),
      response({ toolCalls: [repeatedRead], finishReason: "tool_calls" }),
      response({ text: "使用动作后的新状态回答。" })
    ]);
    const conversation = LLMConversation.create({ id: "invalidate-read-cache" }).unwrap();
    const registry = new LLMToolRegistry({
      parallelSafeNames: ["search_music"],
      reuseSafeNames: ["search_music"]
    });
    const tool = new CountingSearchMusicTool();
    registry.register([tool, new TrackedTool("action", { active: 0, maxActive: 0 })]);

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "读取、修改后再次读取",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 4
      })
    );

    expect(run.result.isOk()).toBe(true);
    expect(tool.executeCount).toBe(2);
  });

  it("fails after maxSteps with yielded tool result messages", async () => {
    const provider = new FakeProvider([
      response({ text: "", toolCalls: [searchCall], finishReason: "tool_calls" })
    ]);
    const conversation = LLMConversation.create({ id: "conversation-4" }).unwrap();

    const registry = new LLMToolRegistry();
    registry.register(new SearchMusicTool());

    const run = await collectRun(
      LLMLoop.run({
        signal,
        conversation,
        input: "找 Aira",
        tools: { registry, strict: true, choice: "auto" },
        provider,
        config: { model: "test", apiKey: "test-key" },
        promptBuilder: new LLMPromptBuilder(),
        maxSteps: 1
      })
    );

    expect(run.result.isErr()).toBe(true);
    if (run.result.isErr()) expect(run.result.reason.type).toBe("max_steps");
    expect(conversation.toMessages()).toEqual([]);
    expect(provider.generateRequests).toHaveLength(0);
    expect(run.events.map((event) => event.type)).toEqual(["tool_call", "tool_result"]);

    const toolResultEvent = run.events.find((event) => event.type === "tool_result");
    expect(toolResultEvent?.type).toBe("tool_result");
    if (toolResultEvent?.type === "tool_result") {
      const partial = LLMConversation.create({
        id: "partial",
        messages: toolResultEvent.messages
      }).unwrap();
      expect(partial.pendingToolCalls()).toHaveLength(0);
    }
  });
});

async function collectRun(
  stream: AsyncGenerator<AIResult<LLMLoopEvent>, AIResult<LLMLoopRunResult>>
) {
  const events: LLMLoopEvent[] = [];
  const errors = [];

  while (true) {
    const next = await stream.next();
    if (next.done) return { events, errors, result: next.value };

    const eventResult = next.value;
    if (eventResult.isErr()) {
      errors.push(eventResult.reason);
    } else {
      events.push(eventResult.unwrap());
    }
  }
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

class FakeProvider extends LLMProvider<TestConfig> {
  readonly requests: LLMGenerateRequest[] = [];
  readonly generateRequests: LLMGenerateRequest[] = [];
  private readonly responses: LLMGenerateResponse[];

  constructor(responses: LLMGenerateResponse[]) {
    super("fake");
    this.responses = [...responses];
  }

  async check(config: TestConfig) {
    return AIResult.ok({ provider: this.name, model: config.model });
  }

  async generate<T extends TestConfig>(_config: T, request: LLMGenerateRequest) {
    this.generateRequests.push(structuredClone(request));
    return AIResult.err({ type: "bad_response", message: "generate should not be used by loop" });
  }

  async *stream<T extends TestConfig>(
    _config: T,
    request: LLMGenerateRequest
  ): AsyncGenerator<AIResult<LLMGenerateStreamResponse>> {
    this.requests.push(structuredClone(request));
    const next = this.responses.shift();
    if (!next) {
      yield AIResult.err({ type: "bad_response", message: "missing fake response" });
      return;
    }

    if (next.text) {
      yield AIResult.ok({ type: "text_delta", text: next.text });
    }

    yield AIResult.ok({
      type: "done",
      text: next.text,
      raw: next.raw,
      usage: next.usage,
      toolCalls: next.toolCalls,
      finishReason: next.finishReason,
      ...(next.providerContext ? { providerContext: next.providerContext } : {})
    });
  }
}

class AutoOnlyProvider extends FakeProvider {
  override getCapabilities() {
    return { supportsRequiredToolChoice: false };
  }
}

const searchSchema = z.object({ keyword: z.string() });

class SearchMusicTool extends LLMTool<typeof searchSchema, string[]> {
  inputSchema;

  constructor() {
    super({ name: "search_music", description: "搜索音乐" });
    this.inputSchema = searchSchema;
  }

  async execute(input: z.infer<typeof searchSchema>): Promise<AIResult<string[]>> {
    return AIResult.ok([input.keyword]);
  }
}

const emptyToolSchema = z.object({});

class DeferredToolDirectory extends LLMTool<typeof emptyToolSchema, { activated: string[] }> {
  readonly inputSchema = emptyToolSchema;

  constructor() {
    super({ name: "tool_directory", description: "按需加载工具" });
  }

  override async execute(_input: object, context: LLMToolContext) {
    context.activateTools?.(["deferred_read", "forbidden_write"]);
    return AIResult.ok({ activated: ["deferred_read"] });
  }
}

class DeferredReadTool extends LLMTool<typeof emptyToolSchema, string> {
  readonly inputSchema = emptyToolSchema;

  constructor() {
    super({ name: "deferred_read", description: "延迟读取" });
  }

  override async execute() {
    return AIResult.ok("ok");
  }
}

class ForbiddenWriteTool extends LLMTool<typeof emptyToolSchema, string> {
  readonly inputSchema = emptyToolSchema;

  constructor() {
    super({ name: "forbidden_write", description: "不得延迟激活的写工具" });
  }

  override async execute() {
    return AIResult.ok("written");
  }
}

class CountingSearchMusicTool extends SearchMusicTool {
  executeCount = 0;

  override async execute(input: z.infer<typeof searchSchema>) {
    this.executeCount += 1;
    return super.execute(input);
  }
}

class FailingSearchMusicTool extends SearchMusicTool {
  override async execute(): Promise<AIResult<string[]>> {
    return AIResult.err({ type: "service", message: "搜索服务不可用" });
  }
}

class FlakySearchMusicTool extends SearchMusicTool {
  private attempts = 0;

  override async execute(input: z.infer<typeof searchSchema>): Promise<AIResult<string[]>> {
    this.attempts += 1;
    if (this.attempts === 1) {
      return AIResult.err({ type: "service", message: "首次搜索暂时失败" });
    }
    return AIResult.ok([input.keyword]);
  }
}

const evidenceBrowserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), query: z.string() }),
  z.object({ action: z.literal("open"), url: z.string() })
]);

class EvidenceBrowserTool extends LLMTool<typeof evidenceBrowserSchema, unknown> {
  readonly inputSchema = evidenceBrowserSchema;

  constructor(
    private readonly trustedURL: string,
    private readonly searchPageURL = "https://search.test/",
    private readonly secondSearchURL?: string
  ) {
    super({ name: "evidence_browser", description: "搜索并打开网页" });
  }

  override async execute(input: z.infer<typeof evidenceBrowserSchema>) {
    return AIResult.ok(
      input.action === "search"
        ? {
            url: this.searchPageURL,
            padding: "x".repeat(2_000),
            results:
              input.query === "empty"
                ? []
                : [
                    {
                      title: "可信文章",
                      url:
                        input.query === "second" && this.secondSearchURL
                          ? this.secondSearchURL
                          : this.trustedURL
                    }
                  ]
          }
        : { title: "网页正文", url: input.url }
    );
  }
}

const emptySchema = z.object({});

class LargeOutputTool extends LLMTool<typeof emptySchema, string> {
  readonly inputSchema = emptySchema;

  constructor() {
    super({ name: "large_output", description: "返回用于预算测试的大文本" });
  }

  override async execute() {
    return AIResult.ok("x".repeat(2_000));
  }
}

class TrackedTool extends LLMTool<typeof emptySchema, string> {
  readonly inputSchema = emptySchema;

  constructor(
    name: string,
    private readonly tracker: { active: number; maxActive: number }
  ) {
    super({ name, description: name });
  }

  override async execute() {
    this.tracker.active += 1;
    this.tracker.maxActive = Math.max(this.tracker.maxActive, this.tracker.active);
    await Promise.resolve();
    this.tracker.active -= 1;
    return AIResult.ok(this.name);
  }
}

class CommitUnknownTool extends LLMTool<typeof emptySchema, string> {
  readonly inputSchema = emptySchema;
  executeCount = 0;

  constructor() {
    super({ name: "side_effect", description: "测试副作用提交状态" });
  }

  override async execute() {
    this.executeCount += 1;
    return AIResult.err({
      type: "commit_unknown",
      message: "请求可能已经提交，但没有收到回执"
    });
  }
}
