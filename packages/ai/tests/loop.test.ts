import { z } from "zod";
import { AIResult } from "@/result";
import { LLMPromptBuilder } from "@/prompt";
import { LLMConversation } from "@/conversations";
import { LLMTool, LLMToolRegistry, type LLMToolContext } from "@/tools";
import { LLMLoop, type LLMLoopEvent, type LLMLoopRunResult } from "@/loop";
import {
  LLMProvider,
  type LLMGenerateRequest,
  type LLMGenerateResponse,
  type LLMGenerateStreamResponse
} from "@/provider";
import type { LLMProviderConfig } from "@/provider/interface";

type TestConfig = LLMProviderConfig;

const signal = new AbortController().signal;
const searchCall = {
  name: "search_music",
  callID: "call_1",
  arguments: JSON.stringify({ keyword: "Aira" })
};

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
    if (run.result.isErr()) expect(run.result.reason.type).toBe("bad_response");
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
      finishReason: next.finishReason
    });
  }
}

const searchSchema = z.object({ keyword: z.string() });

class SearchMusicTool extends LLMTool<typeof searchSchema, string[]> {
  inputSchema;

  constructor() {
    super({ name: "search_music", description: "搜索音乐" });
    this.inputSchema = searchSchema;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(input: z.infer<typeof searchSchema>, _context: LLMToolContext) {
    return AIResult.ok([input.keyword]);
  }
}
