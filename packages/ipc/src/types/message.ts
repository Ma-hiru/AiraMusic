import type { AgentFeatureSettingsState } from "./invoke";
import type {
  AgentToolCancel,
  AgentToolRequest,
  AgentFocusContext,
  AgentToolResponse
} from "./agent";

export type PlayerAction =
  | "next"
  | "play"
  | "pause"
  | "update"
  | "previous"
  | "play-toggle"
  | "toggle-lyric-version-rm"
  | "toggle-lyric-version-tl";

/** 可跨窗口转发的全局快捷键动作，取值与渲染进程的快捷键设置一一对应 */
export type ShortcutAction =
  | "volumeUp"
  | "nextTrack"
  | "prevTrack"
  | "muteToggle"
  | "playToggle"
  | "volumeDown"
  | "playModalToggle";

/**
 * - deliver 表示主要是 main to other
 * - dispatch 表示主要是 other to main
 * */
type MessageBus = {
  /** 其他窗口聚焦时命中的全局快捷键，转发给 main 统一执行 */
  bus_dispatch_shortcut: ShortcutAction;
  bus_dispatch_player_action: PlayerAction;
  /** 宿主 → lyric：强制解锁（幂等，单向，不回报状态）。方案 B 的唯一解锁入口。 */
  bus_deliver_lyric_lock: boolean;
  bus_deliver_focus_context: AgentFocusContext;
  bus_deliver_preview: {
    url: string;
    alt?: string;
  };
  bus_deliver_comment: {
    id: number;
    type: "album" | "track" | "playlist";
  };
  bus_deliver_playlist_action_result: {
    ok: boolean;
    error?: string;
    requestID: string;
  };
  bus_deliver_react_ready:
    | { type: "ready"; sender: WindowType }
    | { type: "isReady"; target: WindowType };
  bus_deliver_device_output_views: {
    selected: string;
    views: { deviceId: string; displayName: string }[];
  };
  bus_dispatch_update:
    | "theme"
    | "output"
    | "history"
    | "play-list"
    | "track-meta"
    | "track-progress";
  bus_deliver_play_list_position: {
    markId: string;
    version: number;
    position: number;
    senderId: string;
    sequence: number;
  };
  bus_deliver_track_progress: {
    /** 实际已加载音频的歌曲，避免切歌时与先后到达的 meta 串用。 */
    volume: number;
    buffered: number;
    duration: number;
    trackID?: number;
    currentTime: number;
  };
  bus_deliver_history: {
    list: {
      id: number;
      name: string;
      time: number;
      sourceID: number;
      playDuration: number;
      detail: NeteaseTrackModel;
      sourceName: NeteaseTrackRecordSourceType;
    }[];
  };
  bus_deliver_theme: {
    backgroundCover: Undefinable<string>;
    theme: {
      mainColor: string;
      themeColors: string[];
      secondaryColor: string;
      textColorOnMain: string;
      textNormalColor: string;
      textColorOnSecondary: string;
    };
  };
  bus_deliver_play_list: {
    markId: string;
    version: number;
    position: number;
    senderId: string;
    sequence: number;
    list: {
      id: number;
      name: string;
      sourceID: number;
      detail: NeteaseTrackModel;
      sourceName: NeteaseTrackRecordSourceType;
    }[];
  };
  bus_deliver_window_event: {
    type: WindowType;
    action:
      | "blur"
      | "hide"
      | "show"
      | "close"
      | "focus"
      | "moved"
      | "ready"
      | "resized"
      | "maximize"
      | "minimize"
      | "unmaximize"
      | "unminimize"
      | "enter-fullscreen"
      | "leave-fullscreen"
      | "always-on-top-changed";
  };
  bus_modify_source:
    | {
        type: "user-playlist";
      }
    | {
        type: "album";
        id: Nullable<number | string>;
      }
    | {
        type: "remove-playlist";
        id: Nullable<number | string>;
      }
    | {
        type: "playlist-update";
        id: Nullable<number | string>;
        source: Nullable<"like" | "normal">;
      };
  bus_deliver_track_meta: {
    quality?: string;
    shuffle: boolean;
    rmActive: boolean;
    tlActive: boolean;
    noteActive: boolean;
    playlistMarkId: string;
    repeat: "all" | "off" | "one";
    lyric: Optional<NeteaseLyricModel>;
    mode: "fm" | "normal" | "intelligence";
    status: "idle" | "error" | "paused" | "loading" | "playing";
    track: Optional<{
      id: number;
      name: string;
      sourceID: number;
      detail: NeteaseTrackModel;
      sourceName: NeteaseTrackRecordSourceType;
    }>;
  };
  bus_display:
    | {
        type: "star";
      }
    | {
        type: "history";
      }
    | {
        type: "settings";
      }
    | {
        type: "play-list";
      }
    | {
        type: "search";
        keyword?: string;
      }
    | {
        id: number;
        type: "album" | "artist";
      }
    | {
        day?: string;
        type: "listening-footprint";
        period?: "week" | "month" | "today";
      }
    | {
        id: number;
        type: "playlist";
        source: "like" | "normal";
        scope?: {
          key: string;
          kind: "album" | "artist";
        };
      };
  bus_dispatch_playlist_action: {
    requestID?: string;
  } & (
    | {
        type: "fmModeDislike";
      }
    | {
        timeMS: number;
        type: "lyricJump";
      }
    | {
        trackID: number;
        type: "playTrack";
      }
    | {
        value: boolean;
        type: "shuffleMode";
      }
    | {
        value: boolean;
        type: "intelligenceMode";
      }
    | {
        type: "repeatMode";
        value: "all" | "off" | "one";
      }
    | {
        allIDs: number[];
        sourceID: number;
        type: "addListToPlaylistEnd";
        sourceType: NeteaseTrackRecordSourceType;
      }
    | {
        trackID: number;
        sourceID: number;
        sourceType: NeteaseTrackRecordSourceType;
        type: "addToPlaylistLast" | "addToPlaylistNext";
      }
    | {
        markId?: string;
        trackID: number;
        allIDs: number[];
        sourceID: number;
        trackIdx: number;
        type: "replacePlaylistAndPlay";
        sourceType: NeteaseTrackRecordSourceType;
        detailType?: NeteaseTrackRecordSourceTypeDetail;
      }
  );
};

/**
 * - deliver 表示是 main to other
 * - dispatch 表示是 other to main
 * */
type MessageSingle = {
  message_dispatch_login: string;
  message_deliver_logout: boolean;
  message_dispatch_need_login: boolean;
  message_dispatch_should_close: boolean;
  message_deliver_renderer_exited: boolean;
  message_dispatch_cache_has_clear: boolean;
  message_dispatch_device_output_set: string;
  message_cancel_agent_tool_request: AgentToolCancel;
  message_dispatch_agent_tool_request: AgentToolRequest;
  message_deliver_agent_tool_response: AgentToolResponse;
  message_deliver_agent_feature_settings: AgentFeatureSettingsState;
};

type MessageEventValue = MessageBus & MessageSingle;

export type MessageEvent = keyof MessageEventValue;

export type MessageBusEvent = keyof MessageBus;

export type MessageSingleEvent = keyof MessageSingle;

export type MessageData<T extends MessageEvent> = MessageEventValue[T];

export type MessageDirection = {
  send: "_send";
  receive: "_receive";
};

export type Message<
  T extends MessageEvent,
  D extends MessageDirection["send"] | MessageDirection["receive"]
> = D extends MessageDirection["send"]
  ? {
      type: T;
      to: WindowType;
      data: MessageData<T>;
    }
  : {
      type: T;
      from: WindowType;
      data: MessageData<T>;
    };
