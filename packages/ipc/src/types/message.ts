import type { AIAgentEvent } from "@mahiru/ai";

import type {
  AgentToolRequest,
  AgentFocusContext,
  AgentToolResponse,
  AgentSettingsContext
} from "./agent";

export type PlayerAction =
  | "exit"
  | "next"
  | "play"
  | "pause"
  | "update"
  | "previous"
  | "toggle-lyric-version-rm"
  | "toggle-lyric-version-tl";

/**
 * - deliver 表示主要是 main to other
 * - dispatch 表示主要是 other to main
 * */
type MessageBus = {
  bus_dispatch_player_action: PlayerAction;
  bus_deliver_focus_context: AgentFocusContext;
  bus_deliver_agent_settings_context: AgentSettingsContext;
  bus_deliver_preview: {
    url: string;
    alt?: string;
  };
  bus_deliver_comment: {
    id: number;
    type: "album" | "track" | "playlist";
  };
  bus_dispatch_update: "theme" | "output" | "history" | "track-meta" | "track-progress";
  bus_deliver_react_ready:
    | { type: "ready"; sender: WindowType }
    | { type: "isReady"; target: WindowType };
  bus_deliver_device_output_views: {
    selected: string;
    views: { deviceId: string; displayName: string }[];
  };
  bus_deliver_track_progress: {
    volume: number;
    buffered: number;
    duration: number;
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
  bus_modify_source:
    | {
        type: "user-playlist";
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
  bus_display:
    | {
        type: "history";
      }
    | {
        type: "settings";
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
        id: number;
        type: "playlist";
        source: "like" | "normal";
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
  bus_deliver_track_meta: {
    shuffle: boolean;
    rmActive: boolean;
    tlActive: boolean;
    noteActive: boolean;
    repeat: "all" | "off" | "one";
    lyric: Optional<NeteaseLyricModel>;
    status: "idle" | "error" | "paused" | "loading" | "playing";
    track: Optional<{
      id: number;
      name: string;
      sourceID: number;
      detail: NeteaseTrackModel;
      sourceName: NeteaseTrackRecordSourceType;
    }>;
  };
  bus_dispatch_playlist_action:
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
        trackID: number;
        allIDs: number[];
        sourceID: number;
        trackIdx: number;
        type: "replacePlaylistAndPlay";
        sourceType: NeteaseTrackRecordSourceType;
      };
};

/**
 * - deliver 表示是 main to other
 * - dispatch 表示是 other to main
 * */
type MessageSingle = {
  message_dispatch_login: string;
  message_dispatch_need_login: boolean;
  message_dispatch_darwin_close: boolean;
  message_dispatch_cache_has_clear: boolean;
  message_dispatch_device_output_set: string;
  message_deliver_agent_chat_event: AIAgentEvent;
  message_dispatch_agent_tool_request: AgentToolRequest;
  message_deliver_agent_tool_response: AgentToolResponse;
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
