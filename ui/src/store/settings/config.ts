import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { TrackQuality } from "@mahiru/ui/utils/track";

export const SettingsStoreConfig: ZustandConfig<
  SettingsStoreInitialState & SettingsStoreActions,
  SettingsStoreInitialState
> = (set, get) => ({
  ...InitialState,
  UpdateSettings: (updater) => {
    set((draft) => {
      const newState = updater(draft.PlayerSettings);
      newState !== undefined && (draft.PlayerSettings = newState);
    });
  }
});

const InitialState: SettingsStoreInitialState = {
  PlayerSettings: {
    musicQuality: TrackQuality.h,
    maxHistoryListLength: 500
  }
};

export type SettingsStoreInitialState = {
  PlayerSettings: {
    musicQuality: TrackQuality;
    maxHistoryListLength: number;
  };
};

export type SettingsStoreActions = {
  UpdateSettings: NormalFunc<
    [
      updater: (
        draft: SettingsStoreInitialState["PlayerSettings"]
      ) => void | SettingsStoreInitialState["PlayerSettings"]
    ]
  >;
};
