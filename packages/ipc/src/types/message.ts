/**
 * - deliver 表示主要是 main to other
 * - dispatch 表示主要是 other to main
 * */
type MessageBus = {
  bus_deliver_theme: {
    backgroundCover: Undefinable<string>;
    theme: {
      mainColor: string;
      secondaryColor: string;
      textColorOnMain: string;
      textColorOnSecondary: string;
      textNormalColor: string;
    };
  };
  bus_deliver_track_meta: {
    track: Optional<{
      id: number;
      name: string;
      sourceID: number;
      sourceName: NeteaseTrackRecordSourceType;
      detail: NeteaseTrackModel;
    }>;
    lyric: Optional<NeteaseLyricModel>;
    repeat: "off" | "one" | "all";
    shuffle: boolean;
    status: "playing" | "paused" | "error" | "idle" | "loading";
    rmActive: boolean;
    tlActive: boolean;
    noteActive: boolean;
  };
  bus_deliver_track_progress: {
    currentTime: number;
    duration: number;
    volume: number;
    buffered: number;
  };
  bus_deliver_window_event: {
    type: WindowType;
    action:
      | "ready"
      | "close"
      | "focus"
      | "hide"
      | "show"
      | "maximize"
      | "unmaximize"
      | "minimize"
      | "unminimize"
      | "moved"
      | "resized"
      | "enter-fullscreen"
      | "leave-fullscreen"
      | "blur"
      | "always-on-top-changed";
  };
  bus_deliver_history: {
    list: {
      id: number;
      name: string;
      sourceID: number;
      sourceName: NeteaseTrackRecordSourceType;
      detail: NeteaseTrackModel;
      playDuration: number;
      time: number;
    }[];
  };
  bus_deliver_device_output_views: {
    selected: string;
    views: { displayName: string; deviceId: string }[];
  };
  bus_deliver_react_ready:
    | { type: "ready"; sender: WindowType }
    | { type: "isReady"; target: WindowType };
  bus_dispatch_update: "theme" | "track-meta" | "track-progress" | "output" | "history";
  bus_deliver_preview: {
    url: string;
    alt?: string;
  };
  bus_deliver_comment: {
    id: number;
    type: "track" | "album" | "playlist";
  };
  bus_dispatch_playlist_action:
    | {
        type: "addToPlaylistNext" | "addToPlaylistLast";
        trackID: number;
        sourceID: number;
        sourceType: NeteaseTrackRecordSourceType;
      }
    | {
        type: "replacePlaylistAndPlay";
        trackID: number;
        trackIdx: number;
        sourceID: number;
        sourceType: NeteaseTrackRecordSourceType;
        allIDs: number[];
      }
    | {
        type: "addListToPlaylistEnd";
        sourceID: number;
        sourceType: NeteaseTrackRecordSourceType;
        allIDs: number[];
      };
  bus_dispatch_player_action:
    | "next"
    | "previous"
    | "play"
    | "pause"
    | "exit"
    | "update"
    | "toggle-lyric-version-rm"
    | "toggle-lyric-version-tl";
  bus_display:
    | {
        id: number;
        type: "album" | "artist";
      }
    | {
        id: number;
        type: "playlist";
        source: "normal" | "like";
      }
    | {
        type: "search";
        keyword?: string;
      }
    | {
        type: "settings";
      }
    | {
        type: "history";
      };
  bus_modify_source:
    | {
        type: "playlist-update";
        id: Nullable<number | string>;
        source: Nullable<"like" | "normal">;
      }
    | {
        type: "user-playlist";
      }
    | {
        type: "remove-playlist";
        id: Nullable<number | string>;
      };
};

/**
 * - deliver 表示是 main to other
 * - dispatch 表示是 other to main
 * */
type MessageSingle = {
  message_dispatch_login: string;
  message_dispatch_device_output_set: string;
  message_dispatch_cache_has_clear: boolean;
  message_dispatch_need_login: boolean;
};

type MessageEventValue = MessageBus & MessageSingle;

export type MessageEvent = keyof MessageEventValue;

export type MessageBusEvent = keyof MessageBus;

export type MessageSingleEvent = keyof MessageSingle;

export type MessageData<T extends MessageEvent> = MessageEventValue[T];

export type MessageDirection = {
  receive: "_receive";
  send: "_send";
};

export type Message<
  T extends MessageEvent,
  D extends MessageDirection["receive"] | MessageDirection["send"]
> = D extends MessageDirection["send"]
  ? {
      to: WindowType;
      data: MessageData<T>;
      type: T;
    }
  : {
      from: WindowType;
      data: MessageData<T>;
      type: T;
    };
