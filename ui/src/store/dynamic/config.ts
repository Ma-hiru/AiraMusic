import { ZustandConfig } from "@mahiru/ui/types/zustand";

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
  }
});

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
  }
};

export interface DynamicStoreInitialState {
  playerStatus: PlayerStatus;
}

export type DynamicStoreActions = {
  setPlayerStatus: (updater: NormalFunc<[draft: PlayerStatus], void | PlayerStatus>) => void;
};
