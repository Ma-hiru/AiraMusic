import { z } from "zod";
import { LLMLoop } from "@/loop";
import { AIResult } from "@/result";
import { LLMPromptBuilder } from "@/prompt";
import { LLMConversation } from "@/conversation";
import { LLMTool, LLMToolRegistry, type LLMToolContext } from "@/tools";
import { LLMProvider, type LLMGenerateRequest, type LLMGenerateResponse } from "@/provider";

type TestConfig = { model: string };

const signal = new AbortController().signal;
const searchCall = {
  name: "search_music",
  callID: "call_1",
  arguments: JSON.stringify({ keyword: "Aira" })
};

describe("LLMLoop", () => {
  it("appends user and final assistant message when no tools are requested", async () => {
    const provider = new FakeProvider([response({ text: "你好，我是 Aira" })]);
    const conversation = LLMConversation.create({ id: "conversation-1" }).unwrap();
    const loop = new LLMLoop({
      provider,
      config: { model: "test" },
      prompt: new LLMPromptBuilder("你是音乐助手"),
      maxSteps: 1
    });

    const result = await loop.run({ signal, conversation, input: "你好" });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().response.text).toBe("你好，我是 Aira");
    expect(conversation.toMessages()).toEqual([
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好，我是 Aira" }
    ]);
    expect(provider.requests[0]?.messages).toEqual([
      { role: "system", content: "你是音乐助手" },
      { role: "user", content: "你好" }
    ]);
  });

  it("executes tool calls, appends tool results, and continues generation", async () => {
    const provider = new FakeProvider([
      response({ text: "", toolCalls: [searchCall], finishReason: "tool_calls" }),
      response({ text: "找到 Aira" })
    ]);
    const registry = LLMToolRegistry.create([new SearchMusicTool()]).unwrap();
    const conversation = LLMConversation.create({ id: "conversation-2" }).unwrap();
    const loop = new LLMLoop({
      provider,
      config: { model: "test" },
      prompt: new LLMPromptBuilder("你是音乐助手"),
      maxSteps: 2
    });

    const result = await loop.run({
      signal,
      conversation,
      input: "找 Aira",
      tools: { registry, strict: true, choice: "auto" }
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().steps).toHaveLength(2);
    expect(result.unwrap().steps[0]?.toolResults[0]?.output).toBe('["Aira"]');
    expect(conversation.pendingToolCalls()).toHaveLength(0);
    expect(conversation.toMessages()).toEqual([
      { role: "user", content: "找 Aira" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' },
      { role: "assistant", content: "找到 Aira" }
    ]);
    expect(provider.requests[1]?.messages).toEqual([
      { role: "system", content: "你是音乐助手" },
      { role: "user", content: "找 Aira" },
      { role: "assistant", toolCalls: [searchCall] },
      { role: "tool", name: "search_music", callID: "call_1", content: '["Aira"]' }
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
    const registry = LLMToolRegistry.create([new SearchMusicTool()]).unwrap();
    const conversation = LLMConversation.create({ id: "conversation-3" }).unwrap();
    const loop = new LLMLoop({
      provider,
      config: { model: "test" },
      prompt: new LLMPromptBuilder(),
      maxSteps: 2
    });

    const result = await loop.run({
      signal,
      conversation,
      input: "找 Aira",
      tools: { registry, strict: true, choice: "auto" }
    });

    expect(result.isOk()).toBe(true);
    const toolMessage = conversation.toMessages().find((message) => message.role === "tool");
    expect(toolMessage?.content).toContain("unknown_tool");
    expect(conversation.pendingToolCalls()).toHaveLength(0);
  });

  it("fails after maxSteps without leaving pending tool calls", async () => {
    const provider = new FakeProvider([
      response({ text: "", toolCalls: [searchCall], finishReason: "tool_calls" })
    ]);
    const registry = LLMToolRegistry.create([new SearchMusicTool()]).unwrap();
    const conversation = LLMConversation.create({ id: "conversation-4" }).unwrap();
    const loop = new LLMLoop({
      provider,
      config: { model: "test" },
      prompt: new LLMPromptBuilder(),
      maxSteps: 1
    });

    const result = await loop.run({
      signal,
      conversation,
      input: "找 Aira",
      tools: { registry, strict: true, choice: "auto" }
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.type).toBe("bad_response");
    expect(conversation.pendingToolCalls()).toHaveLength(0);
  });
});

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
  private readonly responses: LLMGenerateResponse[];

  constructor(responses: LLMGenerateResponse[]) {
    super("fake");
    this.responses = [...responses];
  }

  async check(config: TestConfig) {
    return AIResult.ok({ provider: this.name, model: config.model });
  }

  async generate(_config: TestConfig, request: LLMGenerateRequest) {
    this.requests.push(structuredClone(request));
    const next = this.responses.shift();
    if (!next) {
      return AIResult.err({ type: "bad_response", message: "missing fake response" });
    }
    return AIResult.ok(next);
  }

  async *stream() {
    yield AIResult.err({ type: "bad_response", message: "not implemented" });
  }
}

const searchSchema = z.object({ keyword: z.string() });

class SearchMusicTool extends LLMTool<typeof searchSchema, string[]> {
  readonly name = "search_music";
  readonly description = "搜索音乐";
  readonly inputSchema = searchSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(input: z.infer<typeof searchSchema>, _context: LLMToolContext) {
    return AIResult.ok([input.keyword]);
  }
}
