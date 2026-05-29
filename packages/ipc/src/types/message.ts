type MessageEventValue = {
  login: string;
  infoBus: {
    backgroundCover: Undefinable<string>;
    theme: {
      mainColor: string;
      secondaryColor: string;
      textColor: string;
    };
  };
  playerBus: {
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
  progressBus: {
    currentTime: number;
    duration: number;
    volume: number;
    buffered: number;
  };
  playerActionBus:
    | "next"
    | "previous"
    | "play"
    | "pause"
    | "exit"
    | "update"
    | "toggle-lyric-version-rm"
    | "toggle-lyric-version-tl";
  commentBus: {
    id: number;
    type: "track" | "album" | "playlist";
  };
  windowBus: {
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
      | "blur";
  };
  imageCheckerBus: {
    url: string;
    alt?: string;
  };
  updateBus: "info" | "player" | "progress";
  displayBus:
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
      };
  mergeDisplay: MessageEventValue["displayBus"];
  playerChangeBus:
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
  outputBus: {
    selected: string;
    views: { displayName: string; deviceId: string }[];
  };
  changeOutput: string;
};

export type MessageEvent = keyof MessageEventValue;

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
