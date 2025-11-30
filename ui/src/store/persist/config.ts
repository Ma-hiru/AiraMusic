import { playlistCategories } from "@mahiru/ui/api/utils/staticData";
import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { NeteaseTrack, NeteaseUserDetailResponse } from "@mahiru/ui/types/netease-api";

const enabledPlaylistCategories = playlistCategories.filter((c) => c.enable).map((c) => c.name);

export const PersistStoreConfig: ZustandConfig<
  PersistStoreInitialState & PersistStoreActions,
  PersistStoreInitialState
> = (set, get) => ({
  ...InitialState,
  updatePersistStore(PartialState: Partial<PersistStoreInitialState>) {
    set((state) => {
      Object.entries(PartialState ?? {}).forEach(([key, value]) => {
        // @ts-expect-error
        state[key] = value;
      });
    });
  },
  updatePersistStoreData(PartialData: Partial<PersistStoreInitialState["data"]>) {
    set((state) => {
      Object.entries(PartialData ?? {}).forEach(([key, value]) => {
        // @ts-expect-error
        state.data[key] = value;
      });
    });
  }
});

const InitialState: PersistStoreInitialState = {
  settings: {
    musicQuality: 320000
  },
  data: {
    user: null,
    lastRefreshCookieDate: 0,
    loginMode: "",
    historyList: []
  }
};

export interface PersistStoreInitialState {
  settings: {
    musicQuality: number | string;
  };
  data: {
    user: NeteaseUserDetailResponse["profile"] | null;
    lastRefreshCookieDate: number;
    loginMode: "account" | "username" | "";
    historyList: NeteaseTrack[];
  };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
}
