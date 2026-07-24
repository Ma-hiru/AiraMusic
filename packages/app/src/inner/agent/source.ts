import { MainIPC } from "@mahiru/ipc/main";
import { type MessageData } from "@mahiru/ipc/types";
import {
  AIResult,
  LLMContextSource,
  type LLMContextBlock,
  type LLMContextRuntime
} from "@mahiru/ai";

type AgentFocusContext = MessageData<"bus_deliver_focus_context">;
type AgentTrackMeta = MessageData<"bus_deliver_track_meta">;
type AgentTrackDetail = NonNullable<AgentTrackMeta["track"]>["detail"];

type FocusProjectionLimits = {
  nameChars: number;
  detailChars: number;
  recentItems: number;
};

type TrackProjectionLimits = {
  textChars: number;
  artistItems: number;
};

export const AgentDynamicContextMaxChars = 6_000;
// 6K 总预算中为当前歌曲和两个块标题留出余量，避免 composer 再次按字符硬切。
export const AgentFocusContextMaxChars = 4_400;
const AgentTrackContextMaxChars = 1_200;

const FocusProjectionStages: readonly FocusProjectionLimits[] = [
  { recentItems: 20, nameChars: 120, detailChars: 48 },
  { recentItems: 20, nameChars: 80, detailChars: 32 },
  { recentItems: 16, nameChars: 80, detailChars: 32 },
  { recentItems: 12, nameChars: 64, detailChars: 24 },
  { recentItems: 8, nameChars: 48, detailChars: 20 },
  { recentItems: 4, nameChars: 40, detailChars: 16 },
  { recentItems: 1, nameChars: 32, detailChars: 12 },
  { recentItems: 0, nameChars: 16, detailChars: 8 }
];

const TrackProjectionStages: readonly TrackProjectionLimits[] = [
  { artistItems: 8, textChars: 120 },
  { artistItems: 6, textChars: 96 },
  { artistItems: 4, textChars: 64 },
  { artistItems: 2, textChars: 48 },
  { artistItems: 1, textChars: 32 },
  { artistItems: 0, textChars: 16 }
];

/**
 * 焦点上下文必须先保持结构地裁剪，再交给通用上下文预算器。
 * 这样预算器无需从 JSON 中间截断，模型始终能收到可解析的完整对象。
 */
export function serializeAgentFocusContext(context: AgentFocusContext): string {
  return serializeProjectionStages(
    FocusProjectionStages,
    (limits) => projectFocusContext(context, limits),
    AgentFocusContextMaxChars
  );
}

export class AgentContextCurrentTrackMeta extends LLMContextSource {
  meta: Nullable<MessageData<"bus_deliver_track_meta">> = null;

  constructor() {
    super({ name: "current-track-meta" });
    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (meta) => {
      this.meta = meta;
    });
  }

  async load(runtime: LLMContextRuntime): Promise<AIResult<LLMContextBlock[]>> {
    if (runtime.signal?.aborted) return AIResult.ok([]);
    if (this.meta === null || !this.meta.track) {
      return AIResult.ok([
        {
          key: "current-track-meta",
          title: "当前播放的歌曲信息",
          content: "当前没有播放的歌曲",
          priority: 1,
          role: "user"
        }
      ]);
    }

    const trackDetail = this.meta.track.detail;
    return AIResult.ok([
      {
        key: "current-track-meta",
        title: "当前播放器即时上下文（动态）",
        content: serializeAgentTrackContext(this.meta, trackDetail),
        priority: 1,
        role: "user"
      }
    ]);
  }
}

export class AgentContextCurrentFocusContext extends LLMContextSource {
  context: Nullable<MessageData<"bus_deliver_focus_context">> = null;

  constructor() {
    super({ name: "current-focus-context" });
    MainIPC.MessageChannel.listen("bus_deliver_focus_context", (context) => {
      this.context = context;
    });
  }

  async load(runtime: LLMContextRuntime): Promise<AIResult<LLMContextBlock[]>> {
    if (runtime.signal?.aborted || this.context === null) return AIResult.ok([]);

    return AIResult.ok([
      {
        key: "current-focus-context",
        title: "当前前端焦点上下文",
        content: serializeAgentFocusContext(this.context),
        priority: 1,
        role: "user"
      }
    ]);
  }
}

function projectFocusContext(
  context: AgentFocusContext,
  limits: FocusProjectionLimits
): AgentFocusContext {
  switch (context.page) {
    case "home":
    case "hidden":
    case "settings":
      return { page: context.page };
    case "search":
      return {
        page: "search",
        keyword: compactContextText(context.keyword, limits.nameChars)
      };
    case "album":
    case "artist":
      return {
        page: context.page,
        id: finiteNumber(context.id),
        name: compactContextText(context.name, limits.nameChars)
      };
    case "playlist":
      return {
        page: "playlist",
        id: context.id === null ? null : finiteNumber(context.id),
        source: context.source
      };
    case "history": {
      const recent = Array.isArray(context.recent) ? context.recent : [];
      return {
        page: "history",
        recent: recent.slice(0, limits.recentItems).map((item) => ({
          id: finiteNumber(item.id),
          name: compactContextText(item.name, limits.nameChars),
          time: compactContextText(item.time, limits.detailChars),
          playDuration: compactContextText(item.playDuration, limits.detailChars)
        }))
      };
    }
    default:
      return { page: "hidden" };
  }
}

function serializeAgentTrackContext(meta: AgentTrackMeta, trackDetail: AgentTrackDetail): string {
  return serializeProjectionStages(
    TrackProjectionStages,
    (limits) => {
      const artists = Array.isArray(trackDetail.ar) ? trackDetail.ar : [];
      return {
        status: meta.status,
        playback: {
          repeat: meta.repeat,
          shuffle: meta.shuffle
        },
        lyric: {
          id: meta.lyric?.id === undefined ? undefined : finiteNumber(meta.lyric.id),
          rmExisted: meta.lyric?.rmExisted,
          tlExisted: meta.lyric?.tlExisted,
          noteExisted: meta.lyric?.noteExisted,
          rmActive: meta.rmActive,
          tlActive: meta.tlActive,
          noteActive: meta.noteActive
        },
        track: {
          id: finiteNumber(trackDetail.id),
          name: compactContextText(trackDetail.name, limits.textChars),
          artists: artists.slice(0, limits.artistItems).map((artist) => ({
            id: finiteNumber(artist.id),
            name: compactContextText(artist.name, limits.textChars)
          })),
          album: {
            id: finiteNumber(trackDetail.al.id),
            name: compactContextText(trackDetail.al.name, limits.textChars)
          },
          durationMs: finiteNumber(trackDetail.dt)
        }
      };
    },
    AgentTrackContextMaxChars
  );
}

function serializeProjectionStages<T>(
  stages: readonly T[],
  project: (limits: T) => object,
  maxChars: number
): string {
  let smallest = "{}";
  for (const limits of stages) {
    const serialized = JSON.stringify(project(limits));
    smallest = serialized;
    if (serialized.length <= maxChars) return serialized;
  }
  return smallest.length <= maxChars ? smallest : "{}";
}

function compactContextText(value: unknown, maxChars: number): string {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return normalized.slice(0, Math.max(0, maxChars));
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
