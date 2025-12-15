import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { Lyric } from "@mahiru/ui/utils/lyric";
import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import type { AudioControl } from "@mahiru/ui/hook/usePlayerAudio";
import { API } from "@mahiru/ui/api";

export const DynamicStoreConfig: ZustandConfig<
  DynamicStoreInitialState & DynamicStoreActions,
  DynamicStoreInitialState
> = (set, get) => ({
  ...InitialState,
  setPlayerStatus: (updater) => {
    set((draft) => {
      const newStatus = updater(draft.playerStatus);
      newStatus && (draft.playerStatus = newStatus);
    });
  },
  setTrackStatus: (updater) => {
    set((draft) => {
      const newStatus = updater(draft.trackStatus);
      newStatus !== undefined && (draft.trackStatus = newStatus);
    });
  },
  setLyricVersion: (next) => {
    const { trackStatus, playerStatus } = get();
    const chosenVersion = Lyric.checkLyricVersion(
      trackStatus?.lyric,
      next,
      playerStatus.lyricVersion
    );
    set((draft) => {
      draft.playerStatus.lyricVersion = chosenVersion;
      draft.playerStatus.lyricPreference = next;
    });
  },
  beforeTrackUpdate: (next) => {
    const { trackStatus, playerProgress } = get();
    if (trackStatus && trackStatus.track.id !== next?.track.id) {
      API.Track.scrobble(trackStatus, playerProgress.current().currentTime);
      void PlaylistHistoryCache.addTrack(trackStatus.track);
      set((draft) => {
        if (draft.playerStatus.playing) {
          draft.playerStatus.playing = false;
        }
      });
    }
  },
  requestCanScrollTop: (type, callback?) => {
    set((draft) => {
      if (draft.canScrollTop.type !== type) {
        draft.canScrollTop.type = type;
        draft.canScrollTop.callback = callback;
      }
    });
  },
  togglePlayerModalVisible: () => {
    set((draft) => {
      draft.playerModalVisible = !draft.playerModalVisible;
    });
  },
  toggleSideBarOpen: () => {
    set((draft) => {
      draft.sideBarOpen = !draft.sideBarOpen;
    });
  },
  setBackground: (bg) => {
    set((draft) => {
      draft.background = bg || undefined;
    });
  },
  setKmeansColor: (colors) => {
    set((draft) => {
      draft.kmeansColor = colors;
    });
  },
  setAudioRef: (audio) => {
    set((draft) => {
      draft.audioRef.current = audio;
    });
  },
  setAudioControl: (control) => {
    set((draft) => {
      draft.audioControl.current = control;
    });
  }
});

const playerProgress: PlayerProgress = {
  size: 0,
  buffered: 0,
  duration: 0,
  currentTime: 0
};

const InitialState: DynamicStoreInitialState = {
  audioRef: { current: () => null },
  audioControl: { current: () => null },
  playerStatus: {
    playing: false,
    position: 0,
    repeat: "off",
    shuffle: false,
    volume: 0.5,
    volumeBeforeMute: 0.5,
    lyricPreference: null,
    lyricVersion: "raw"
  },
  trackStatus: null,
  playerProgress: {
    current: () => playerProgress
  },
  canScrollTop: {
    type: "none"
  },
  playerModalVisible: false,
  sideBarOpen: false,
  background: undefined,
  kmeansColor: []
};

export interface DynamicStoreInitialState {
  audioRef: {
    current: NormalFunc<[], Nullable<HTMLAudioElement>>;
  };
  audioControl: {
    current: NormalFunc<[], Nullable<AudioControl>>;
  };
  playerStatus: PlayerStatus;
  playerProgress: { current: () => PlayerProgress };
  trackStatus: Nullable<PlayerTrackStatus>;
  canScrollTop: {
    type: LayoutCanScrollTop;
    callback?: () => void;
  };
  playerModalVisible: boolean;
  sideBarOpen: boolean;
  background: Undefinable<string>;
  kmeansColor: string[];
}

export type DynamicStoreActions = {
  setPlayerStatus: NormalFunc<[updater: NormalFunc<[draft: PlayerStatus], void | PlayerStatus>]>;
  setTrackStatus: NormalFunc<
    [updater: NormalFunc<[draft: Nullable<PlayerTrackStatus>], void | Nullable<PlayerTrackStatus>>]
  >;
  setLyricVersion: NormalFunc<[next: LyricVersionType]>;
  beforeTrackUpdate: NormalFunc<[next: Nullable<PlayerTrackStatus>]>;
  requestCanScrollTop: NormalFunc<[type: LayoutCanScrollTop, callback?: NormalFunc]>;
  togglePlayerModalVisible: NormalFunc;
  toggleSideBarOpen: NormalFunc;
  setBackground: NormalFunc<[bg: Optional<string>]>;
  setKmeansColor: NormalFunc<[colors: string[]]>;
  setAudioRef: NormalFunc<[ref: NormalFunc<[], Nullable<HTMLAudioElement>>]>;
  setAudioControl: NormalFunc<[control: NormalFunc<[], Nullable<AudioControl>>]>;
};
