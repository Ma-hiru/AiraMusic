import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { PlayerFSM, PlayerFSMEvent, PlayerFSMStatus } from "@mahiru/ui/store/player/fsm";
import type { AudioControl } from "@mahiru/ui/hook/usePlayerAudio";
import { SpectrumData, SpectrumOptions } from "@mahiru/ui/hook/useSpectrumWorker";
import { API } from "@mahiru/ui/api";
import { PlaylistHistoryCache } from "@mahiru/ui/utils/history";
import { LyricManager } from "@mahiru/ui/utils/lyricManager";

const playerFSM = new PlayerFSM(PlayerFSMStatus.idle);
const playerFSMEventStack: { stack: PlayerFSMEvent[]; timer: Nullable<number> } = {
  stack: [],
  timer: null
};
const playerProgress: PlayerProgress = {
  size: 0,
  buffered: 0,
  duration: 0,
  currentTime: 0
};

export const PlayerStoreConfig: ZustandConfig<
  PlayerStoreInitialState & PlayerStoreActions,
  PlayerStoreInitialState
> = (set, get) => ({
  ...InitialState,
  TriggerPlayerFSMEvent: (event) => {
    playerFSMEventStack.stack.push(event);
    playerFSMEventStack.timer && clearTimeout(playerFSMEventStack.timer);
    playerFSMEventStack.timer = window.setTimeout(() => {
      set((draft) => {
        const nextStatus = playerFSMEventStack.stack.reduce(
          (fsm, event) => fsm.next(event),
          playerFSM
        ).current;
        playerFSMEventStack.stack = [];
        playerFSMEventStack.timer = null;
        if (draft.PlayerFSMStatus !== nextStatus) {
          draft.PlayerFSMStatus = nextStatus;
        }
      });
    }, 300);
  },
  SetAudioRefGetter: (getter) => {
    set((draft) => {
      draft.AudioRefGetter = getter;
    });
  },
  SetAudioControlGetter: (getter) => {
    set((draft) => {
      draft.AudioControlGetter = getter;
    });
  },
  SetPlayerStatus: (updater) => {
    set((draft) => {
      const newStatus = updater(draft.PlayerStatus);
      newStatus !== undefined && (draft.PlayerStatus = newStatus);
    });
  },
  SetLyricVersion: (next) => {
    const { PlayerTrackStatus, PlayerStatus } = get();
    const chosenVersion = LyricManager.checkLyricVersion(
      PlayerTrackStatus?.lyric,
      next,
      PlayerStatus.lyricVersion
    );
    set((draft) => {
      draft.PlayerStatus.lyricVersion = chosenVersion;
      draft.PlayerStatus.lyricPreference = next;
    });
  },
  SetPlayerTrackStatus: (updater) => {
    set((draft) => {
      const { PlayerTrackStatus, PlayerProgressGetter } = get();

      const newStatus = updater(draft.PlayerTrackStatus);
      newStatus !== undefined && (draft.PlayerTrackStatus = newStatus);

      if (
        PlayerTrackStatus &&
        (newStatus !== undefined ||
          draft.PlayerTrackStatus?.track.id !== PlayerTrackStatus.track.id)
      ) {
        API.Track.scrobble(PlayerTrackStatus, PlayerProgressGetter().currentTime);
        void PlaylistHistoryCache.addTrack(PlayerTrackStatus.track);
      }
    });
  },
  SetPlayerInitialized: (initialized) => {
    set((draft) => {
      draft.PlayerInitialized = initialized;
    });
  },
  SetSpectrumGetter: (getter) => {
    set((draft) => {
      draft.SpectrumGetter = getter;
    });
  }
});

const InitialState: PlayerStoreInitialState = {
  AudioRefGetter: () => null,
  AudioControlGetter: () => null,
  PlayerProgressGetter: () => playerProgress,
  SpectrumGetter: () => ({
    options: null,
    data: null,
    ready: false
  }),
  PlayerStatus: {
    playing: false,
    position: 0,
    repeat: "off",
    shuffle: false,
    volume: 0.5,
    lyricPreference: null,
    lyricVersion: "raw"
  },
  PlayerTrackStatus: null,
  PlayerInitialized: false,
  PlayerFSMStatus: playerFSM.current
};

export type PlayerStoreInitialState = {
  PlayerFSMStatus: PlayerFSMStatus;
  AudioRefGetter: NormalFunc<[], Nullable<HTMLAudioElement>>;
  AudioControlGetter: NormalFunc<[], Nullable<AudioControl>>;
  PlayerProgressGetter: NormalFunc<[], PlayerProgress>;
  PlayerStatus: PlayerStatus;
  PlayerTrackStatus: Nullable<PlayerTrackStatus>;
  PlayerInitialized: boolean;
  SpectrumGetter: NormalFunc<
    [],
    {
      options: Nullable<SpectrumOptions>;
      data: Nullable<NormalFunc<[], SpectrumData>>;
      ready: boolean;
    }
  >;
};

export type PlayerStoreActions = {
  TriggerPlayerFSMEvent: NormalFunc<[event: PlayerFSMEvent]>;
  SetAudioRefGetter: NormalFunc<[getter: () => Nullable<HTMLAudioElement>]>;
  SetAudioControlGetter: NormalFunc<[getter: () => Nullable<AudioControl>]>;
  SetSpectrumGetter: NormalFunc<
    [
      getter: () => {
        options: Nullable<SpectrumOptions>;
        data: Nullable<NormalFunc<[], SpectrumData>>;
        ready: boolean;
      }
    ]
  >;
  SetPlayerStatus: NormalFunc<[updater: (draft: PlayerStatus) => void | PlayerStatus]>;
  SetLyricVersion: NormalFunc<[next: LyricVersionType]>;
  SetPlayerTrackStatus: NormalFunc<
    [updater: (draft: Nullable<PlayerTrackStatus>) => void | Nullable<PlayerTrackStatus>]
  >;
  SetPlayerInitialized: NormalFunc<[initialized: boolean]>;
};
