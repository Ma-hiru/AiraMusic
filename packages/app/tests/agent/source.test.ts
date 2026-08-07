import { LLMContextComposer } from "@mahiru/ai";
import {
  AgentFocusContextMaxChars,
  serializeAgentFocusContext,
  AgentDynamicContextMaxChars,
  AgentContextCurrentTrackMeta,
  AgentContextCurrentFocusContext
} from "@mahiru/app/inner/agent/source";
import type { MessageData } from "@mahiru/ipc/types";

const mocks = vi.hoisted(() => ({
  listen: vi.fn()
}));

vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: {
    MessageChannel: {
      listen: mocks.listen
    }
  }
}));

describe("Agent 动态上下文来源", () => {
  beforeEach(() => {
    mocks.listen.mockClear();
  });

  it("历史页焦点上下文经过 6K 动态预算后仍是完整 JSON", async () => {
    const source = new AgentContextCurrentFocusContext();
    source.context = createOversizedHistoryContext();
    const composer = new LLMContextComposer({
      inject: undefined as never,
      defaultMaxChars: AgentDynamicContextMaxChars,
      sources: [source]
    });

    const result = await composer.compose();
    expect(result.isOk()).toBe(true);

    const content = result.unwrap().blocks[0]?.content ?? "";
    expect(content.length).toBeLessThan(AgentDynamicContextMaxChars);
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("纯序列化函数稳定限制历史条目、文本和额外字段", () => {
    const context = {
      ...createOversizedHistoryContext(),
      rendererState: "不应进入 Agent 上下文"
    } as unknown as MessageData<"bus_deliver_focus_context">;

    const first = serializeAgentFocusContext(context);
    const second = serializeAgentFocusContext(context);
    const parsed = JSON.parse(first) as {
      page: string;
      rendererState?: string;
      recent: Array<{ name: string; time: string; playDuration: string }>;
    };

    expect(first).toBe(second);
    expect(first.length).toBeLessThanOrEqual(AgentFocusContextMaxChars);
    expect(first.length).toBeLessThan(AgentDynamicContextMaxChars);
    expect(parsed.page).toBe("history");
    expect(parsed.recent.length).toBeLessThanOrEqual(20);
    expect(parsed.recent.every((item) => item.name.length <= 120)).toBe(true);
    expect(parsed.recent.every((item) => item.time.length <= 48)).toBe(true);
    expect(parsed.recent.every((item) => item.playDuration.length <= 48)).toBe(true);
    expect(parsed.rendererState).toBeUndefined();
  });

  it("当前歌曲和历史页同时存在时不会让 composer 截断任一 JSON", async () => {
    const trackSource = new AgentContextCurrentTrackMeta();
    trackSource.meta = createOversizedTrackMeta();
    const focusSource = new AgentContextCurrentFocusContext();
    focusSource.context = createOversizedHistoryContext();
    const composer = new LLMContextComposer({
      inject: undefined as never,
      defaultMaxChars: AgentDynamicContextMaxChars,
      sources: [trackSource, focusSource]
    });

    const result = await composer.compose();
    const composed = result.unwrap();
    const trackContent = composed.blocks.find(
      (block) => block.key === "current-track-meta"
    )?.content;
    const focusContent = composed.blocks.find(
      (block) => block.key === "current-focus-context"
    )?.content;

    expect(result.isOk()).toBe(true);
    expect(composed.blocks).toHaveLength(2);
    expect(() => JSON.parse(trackContent ?? "")).not.toThrow();
    expect(() => JSON.parse(focusContent ?? "")).not.toThrow();
    expect(composed.messages[0]?.content.length).toBeLessThan(AgentDynamicContextMaxChars);
  });
});

function createOversizedHistoryContext(): MessageData<"bus_deliver_focus_context"> {
  return {
    page: "history",
    recent: Array.from({ length: 80 }, (_, index) => ({
      id: index + 1,
      name: `歌曲 ${index + 1} ${"很长的歌曲名称".repeat(40)}`,
      time: `播放时间 ${"2026-07-24 20:00 ".repeat(10)}`,
      playDuration: `播放时长 ${"03:45 ".repeat(20)}`
    }))
  };
}

function createOversizedTrackMeta(): MessageData<"bus_deliver_track_meta"> {
  return {
    status: "playing",
    repeat: "all",
    shuffle: false,
    lyric: undefined,
    rmActive: false,
    tlActive: true,
    noteActive: false,
    mode: "normal",
    track: {
      id: 1,
      name: "超长歌曲名".repeat(100),
      sourceID: 1,
      sourceName: "playlist",
      detail: {
        id: 1,
        name: "超长歌曲名".repeat(100),
        dt: 180_000,
        ar: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          name: `超长艺人名 ${index + 1}`.repeat(40)
        })),
        al: {
          id: 1,
          name: "超长专辑名".repeat(100)
        }
      } as NeteaseTrackModel
    }
  };
}
