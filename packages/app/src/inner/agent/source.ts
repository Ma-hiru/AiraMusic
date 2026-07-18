import { MainIPC } from "@mahiru/ipc/main";
import { type MessageData } from "@mahiru/ipc/types";
import {
  AIResult,
  LLMContextSource,
  type LLMContextBlock,
  type LLMContextRuntime
} from "@mahiru/ai";

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
        content: JSON.stringify({
          status: this.meta.status,
          playback: {
            repeat: this.meta.repeat,
            shuffle: this.meta.shuffle
          },
          lyric: {
            id: this.meta.lyric?.id,
            rmExisted: this.meta.lyric?.rmExisted,
            tlExisted: this.meta.lyric?.tlExisted,
            noteExisted: this.meta.lyric?.noteExisted,
            rmActive: this.meta.rmActive,
            tlActive: this.meta.tlActive,
            noteActive: this.meta.noteActive
          },
          track: {
            id: trackDetail.id,
            name: trackDetail.name,
            artists: trackDetail.ar.map((artist) => ({ id: artist.id, name: artist.name })),
            album: { id: trackDetail.al.id, name: trackDetail.al.name },
            durationMs: trackDetail.dt
          }
        }),
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
        content: JSON.stringify(this.context),
        priority: 1,
        role: "user"
      }
    ]);
  }
}
