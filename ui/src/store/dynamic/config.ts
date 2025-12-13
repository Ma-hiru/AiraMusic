import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { Lyric } from "@mahiru/ui/utils/lyric";
import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import { scrobble } from "@mahiru/ui/api/track";

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
  setLyricVersion: (next: LyricVersionType) => {
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
  beforeTrackUpdate: (next: Nullable<PlayerTrackStatus>) => {
    const { trackStatus, playerProgress } = get();
    if (trackStatus && trackStatus.track.id !== next?.track.id) {
      scrobble(trackStatus, playerProgress.current().currentTime);
      void PlaylistHistoryCache.addTrack(trackStatus.track);
      set((draft) => {
        if (draft.playerStatus.playing) {
          draft.playerStatus.playing = false;
        }
      });
    }
  }
});

const playerProgress: PlayerProgress = {
  size: 0,
  buffered: 0,
  duration: 0,
  currentTime: 0
};

const InitialState: DynamicStoreInitialState = {
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
  }
};

export interface DynamicStoreInitialState {
  playerStatus: PlayerStatus;
  playerProgress: {
    current: () => PlayerProgress;
  };
  trackStatus: Nullable<PlayerTrackStatus>;
}

export type DynamicStoreActions = {
  setPlayerStatus: (updater: NormalFunc<[draft: PlayerStatus], void | PlayerStatus>) => void;
  setTrackStatus: (
    updater: NormalFunc<[draft: Nullable<PlayerTrackStatus>], void | Nullable<PlayerTrackStatus>>
  ) => void;
  setLyricVersion: (next: LyricVersionType) => void;
  beforeTrackUpdate: (next: Nullable<PlayerTrackStatus>) => void;
};
