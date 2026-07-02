import { z } from "zod";
import { AIResult } from "@/result";
import { LLMPromptBuilder } from "@/prompt";
import { LLMConversation } from "@/conversation";
import { LLMTool, LLMToolRegistry, type LLMToolContext } from "@/tools";
import { LLMContextComposer, type LLMContextBlock, type LLMContextSource } from "@/context";
import type { AIInject } from "@/inject";

const baseInject = {
  Log: () => undefined,
  CreateID: () => "id",
  ConversationStore: {
    list: async () => AIResult.ok([]),
    remove: async () => AIResult.ok(undefined),
    write: async () => AIResult.ok(undefined),
    read: async () => AIResult.ok(undefined)
  }
} satisfies AIInject;

describe("LLMPromptBuilder", () => {
  it("builds provider request from system prompt, context, conversation, and current input", async () => {
    const signal = new AbortController().signal;
    const conversation = LLMConversation.create({ id: "conversation-1" }).unwrap();
    expect(conversation.appendMessage({ role: "user", content: "上一轮问题" }).isOk()).toBe(true);
    expect(conversation.appendMessage({ role: "assistant", content: "上一轮回答" }).isOk()).toBe(
      true
    );

    const context = new LLMContextComposer({
      inject: baseInject,
      sources: [source("player", 10, [{ key: "track", content: "当前歌曲：Aira" }])]
    });
    const builder = new LLMPromptBuilder("你是 AiraMusic 的音乐助手");

    const result = await builder.build({
      signal,
      conversation,
      input: "继续推荐",
      context: { composer: context },
      temperature: 0.2,
      maxOutputTokens: 256
    });

    expect(result.isOk()).toBe(true);
    const built = result.unwrap();
    expect(built.request.signal).toBe(signal);
    expect(built.request.temperature).toBe(0.2);
    expect(built.request.maxOutputTokens).toBe(256);
    expect(built.request.messages).toEqual([
      { role: "system", content: "你是 AiraMusic 的音乐助手" },
      { role: "system", content: "[track]\n当前歌曲：Aira" },
      { role: "user", content: "上一轮问题" },
      { role: "assistant", content: "上一轮回答" },
      { role: "user", content: "继续推荐" }
    ]);
    expect(conversation.toMessages()).toHaveLength(2);
  });

  it("passes build signal to context composer", async () => {
    const signal = new AbortController().signal;
    let receivedSignal: undefined | AbortSignal;
    const context = new LLMContextComposer({
      inject: baseInject,
      sources: [
        {
          name: "runtime",
          async load(runtime) {
            receivedSignal = runtime.signal;
            return AIResult.ok([{ key: "runtime", content: "context" }]);
          }
        }
      ]
    });
    const conversation = LLMConversation.create({ id: "conversation-signal" }).unwrap();

    const result = await new LLMPromptBuilder().build({
      signal,
      conversation,
      input: "hello",
      context: { composer: context }
    });

    expect(result.isOk()).toBe(true);
    expect(receivedSignal).toBe(signal);
    expect(result.unwrap().request.signal).toBe(signal);
  });

  it("uses explicit tool config", async () => {
    const signal = new AbortController().signal;
    const registry = LLMToolRegistry.create([new SearchMusicTool()]).unwrap();
    const conversation = LLMConversation.create({ id: "conversation-tools" }).unwrap();

    const result = await new LLMPromptBuilder().build({
      signal,
      conversation,
      input: "找一首歌",
      tools: {
        registry,
        strict: true,
        choice: "required"
      }
    });

    expect(result.isOk()).toBe(true);
    const request = result.unwrap().request;
    expect(request.toolChoice).toBe("required");
    expect(request.tools).toHaveLength(1);
    expect(request.tools?.[0]?.name).toBe("search_music");
    expect(request.tools?.[0]?.strict).toBe(true);
  });

  it("fails when conversation has pending tool calls", async () => {
    const signal = new AbortController().signal;
    const conversation = LLMConversation.create({ id: "conversation-2" }).unwrap();
    expect(
      conversation
        .appendMessage({
          role: "assistant",
          toolCalls: [{ name: "search_music", callID: "call_1", arguments: "{}" }]
        })
        .isOk()
    ).toBe(true);

    const result = await new LLMPromptBuilder().build({ signal, conversation, input: "继续" });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.type).toBe("invalid_conversation");
  });
});

function source(name: string, priority: number, blocks: LLMContextBlock[]): LLMContextSource {
  return {
    name,
    priority,
    async load() {
      return AIResult.ok(blocks);
    }
  };
}

const searchSchema = z.object({ keyword: z.string() });

class SearchMusicTool extends LLMTool<typeof searchSchema, string[]> {
  readonly name = "search_music";
  readonly description = "搜索音乐";
  readonly inputSchema = searchSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(_input: z.infer<typeof searchSchema>, _context: LLMToolContext) {
    return AIResult.ok(["Aira"]);
  }
}
