import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { PlayerFSM, PlayerFSMEvent, PlayerFSMStatusEnum } from "@mahiru/ui/store/player/fsm";
import { AudioControl } from "@mahiru/ui/hook/usePlayerAudio";
import { SpectrumData, SpectrumOptions } from "@mahiru/ui/hook/useSpectrumWorker";
import { LyricManager } from "@mahiru/ui/utils/lyricManager";
import { PlayerCore } from "@mahiru/ui/store/player/core";

function createPlayerRuntime() {
  const playerFSM = new PlayerFSM(PlayerFSMStatusEnum.idle);
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
  const playerCore = new PlayerCore();
  return {
    playerFSM,
    playerFSMEventStack,
    playerProgress,
    playerCore
  };
}

const runtime = createPlayerRuntime();

export const PlayerStoreConfig: ZustandConfig<
  PlayerStoreInitialState & PlayerStoreActions,
  PlayerStoreInitialState
> = (set, get) => ({
  ...InitialState,
  TriggerPlayerFSMEvent: (event) => {
    runtime.playerFSMEventStack.stack.push(event);
    runtime.playerFSMEventStack.timer && clearTimeout(runtime.playerFSMEventStack.timer);
    runtime.playerFSMEventStack.timer = window.setTimeout(() => {
      set((draft) => {
        const nextStatus = runtime.playerFSMEventStack.stack.reduce(
          (fsm, event) => fsm.next(event),
          runtime.playerFSM
        ).current;
        runtime.playerFSMEventStack.stack = [];
        runtime.playerFSMEventStack.timer = null;
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
      const newStatus = updater(draft.PlayerTrackStatus);
      newStatus !== undefined && (draft.PlayerTrackStatus = newStatus);
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
  },
  InitPlayerCore: () => {
    if (runtime.playerFSM.current !== get().PlayerFSMStatus) {
      runtime.playerFSM = new PlayerFSM(get().PlayerFSMStatus);
    }

    const progressCache = localStorage.getItem("playerProgressCache");
    if (progressCache) {
      try {
        const progress = JSON.parse(progressCache) as PlayerProgress;
        runtime.playerProgress.currentTime = progress.currentTime;
        runtime.playerProgress.duration = progress.duration;
        runtime.playerProgress.buffered = progress.buffered;
        runtime.playerProgress.size = progress.size;
      } catch {
        runtime.playerProgress = {
          size: 0,
          buffered: 0,
          duration: 0,
          currentTime: 0
        };
      }
    }

    runtime.playerCore.Sync();
    set((draft) => {
      draft.PlayerInitialized = true;
      draft.PlayerCoreGetter = () => runtime.playerCore;
    });
  },
  SavePlayerCore: () => {
    localStorage.setItem("playerProgressCache", JSON.stringify(runtime.playerProgress));
  },
  SetSpectrumOptions: (options) => {
    set((draft) => {
      draft.SpectrumOptions = options;
    });
  }
});

const InitialState: PlayerStoreInitialState = {
  AudioRefGetter: () => null,
  AudioControlGetter: () => null,
  PlayerProgressGetter: () => runtime.playerProgress,
  SpectrumOptions: null,
  SpectrumGetter: () => ({
    data: null,
    ready: false
  }),
  PlayerCoreGetter: () => null,
  PlayerStatus: {
    position: 0,
    repeat: "off",
    shuffle: false,
    volume: 0.5,
    lyricPreference: null,
    lyricVersion: "raw",
    playerList: []
  },
  PlayerTrackStatus: null,
  PlayerInitialized: false,
  PlayerFSMStatus: PlayerFSMStatusEnum.idle
};

export type PlayerStoreInitialState = {
  PlayerFSMStatus: PlayerFSMStatusEnum;
  AudioRefGetter: NormalFunc<[], Nullable<HTMLAudioElement>>;
  AudioControlGetter: NormalFunc<[], Nullable<AudioControl>>;
  PlayerCoreGetter: NormalFunc<[], Nullable<PlayerCore>>;
  PlayerProgressGetter: NormalFunc<[], PlayerProgress>;
  PlayerStatus: PlayerStatus;
  PlayerTrackStatus: Nullable<PlayerTrackStatus>;
  PlayerInitialized: boolean;
  SpectrumOptions: Nullable<SpectrumOptions>;
  SpectrumGetter: NormalFunc<
    [],
    {
      data: Nullable<NormalFunc<[], SpectrumData>>;
      ready: boolean;
    }
  >;
};

export type PlayerStoreActions = {
  TriggerPlayerFSMEvent: NormalFunc<[event: PlayerFSMEvent]>;
  SetAudioRefGetter: NormalFunc<[getter: () => Nullable<HTMLAudioElement>]>;
  SetAudioControlGetter: NormalFunc<[getter: () => Nullable<AudioControl>]>;
  SetSpectrumGetter: NormalFunc<[getter: PlayerStoreInitialState["SpectrumGetter"]]>;
  SetSpectrumOptions: NormalFunc<[options: Nullable<SpectrumOptions>]>;
  SetPlayerStatus: NormalFunc<[updater: (draft: PlayerStatus) => void | PlayerStatus]>;
  SetLyricVersion: NormalFunc<[next: LyricVersionType]>;
  SetPlayerTrackStatus: NormalFunc<
    [updater: (draft: Nullable<PlayerTrackStatus>) => void | Nullable<PlayerTrackStatus>]
  >;
  SetPlayerInitialized: NormalFunc<[initialized: boolean]>;
  InitPlayerCore: NormalFunc;
  SavePlayerCore: NormalFunc;
};
