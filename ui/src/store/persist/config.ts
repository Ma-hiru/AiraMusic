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
  },
  updatePlayHistory(track: NeteaseTrack) {
    set((draft) => {
      const historyList = draft.data.historyList;
      // 移除已有的记录
      const existingIndex = historyList.findIndex((t) => t.id === track.id);
      if (existingIndex !== -1) {
        historyList.splice(existingIndex, 1);
      }
      // 添加到最前面
      historyList.unshift(track);
      // 限制最大长度
      if (historyList.length > draft.settings.maxHistoryListLength) {
        historyList.pop();
      }
    });
  }
});

const InitialState: PersistStoreInitialState = {
  settings: {
    musicQuality: 320000,
    maxHistoryListLength: 500
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
    maxHistoryListLength: number;
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
  updatePlayHistory: (track: NeteaseTrack) => void;
}
