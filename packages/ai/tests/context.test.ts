import { AIResult } from "@/result";
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

describe("LLMContextComposer", () => {
  it("loads injected sources, filters expired blocks, and orders by priority", async () => {
    const composer = new LLMContextComposer({
      inject: baseInject,
      sources: [
        source("player", 20, [
          { key: "track", content: "当前歌曲：Aira", priority: 10 },
          { key: "expired", content: "过期", expiresAt: 99 }
        ]),
        source("playlist", 5, [{ key: "queue", content: "播放队列：3 首" }])
      ],
      now: () => 100
    });

    const result = await composer.compose();
    expect(result.isOk()).toBe(true);

    const composed = result.unwrap();
    expect(composed.blocks.map((block) => block.key)).toEqual(["track", "queue"]);
    expect(composed.messages).toEqual([
      {
        role: "system",
        content: "[track]\n当前歌曲：Aira\n\n[queue]\n播放队列：3 首"
      }
    ]);
  });

  it("keeps optional source failures as skipped sources", async () => {
    const composer = new LLMContextComposer({
      inject: baseInject,
      sources: [
        {
          name: "optional-broken",
          async load() {
            return AIResult.err({ type: "context_load", message: "broken" });
          }
        },
        source("healthy", 0, [{ key: "ok", content: "可用" }])
      ]
    });

    const result = await composer.compose();
    expect(result.isOk()).toBe(true);

    const composed = result.unwrap();
    expect(composed.skippedSources).toHaveLength(1);
    expect(composed.blocks.map((block) => block.key)).toEqual(["ok"]);
  });

  it("fails when a required source fails", async () => {
    const composer = new LLMContextComposer({
      inject: baseInject,
      sources: [
        {
          name: "required-broken",
          required: true,
          async load() {
            return AIResult.err({ type: "context_load", message: "broken" });
          }
        }
      ]
    });

    const result = await composer.compose();
    expect(result.isErr()).toBe(true);
  });

  it("applies character budget after priority sorting", async () => {
    const composer = new LLMContextComposer({
      inject: baseInject,
      sources: [
        source("low", 0, [{ key: "low", content: "低优先级内容" }]),
        source("high", 100, [{ key: "high", content: "高优先级内容很长" }])
      ]
    });

    const result = await composer.compose({ maxChars: 18 });
    expect(result.isOk()).toBe(true);

    const composed = result.unwrap();
    expect(composed.blocks).toHaveLength(1);
    expect(composed.blocks[0]?.key).toBe("high");
    expect(composed.messages[0]?.content.startsWith("[high]")).toBe(true);
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
