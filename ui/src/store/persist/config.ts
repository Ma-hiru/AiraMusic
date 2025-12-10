import { ZustandConfig } from "@mahiru/ui/types/zustand";

const historyListStatic: NeteaseTrack[] = [];

export const PersistStoreConfig: ZustandConfig<
  PersistStoreInitialState & PersistStoreActions,
  PersistStoreInitialState
> = (set, get) => ({
  ...InitialState,
  getHistoryListStatic: () => historyListStatic,
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
      const historyList = draft.data._historyList || [];
      // 移除已有的记录
      const existingIndex = historyList.findIndex((t) => t.id === track.id);
      if (existingIndex !== -1) {
        historyList.splice(existingIndex, 1);
        historyListStatic.splice(existingIndex, 1);
      }
      // 添加到最前面
      historyList.unshift(track);
      historyListStatic.unshift(track);
      // 限制最大长度
      if (historyList.length > get().settings.maxHistoryListLength) {
        historyList.pop();
        historyListStatic.pop();
      }
    });
  },
  clearHistoryList() {
    set((draft) => {
      draft.data._historyList = [];
      historyListStatic.length = 0;
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
    lastRefreshCookieDate: null,
    loginMode: "",
    _historyList: []
  }
};

export interface PersistStoreInitialState {
  settings: {
    musicQuality: number | string;
    maxHistoryListLength: number;
  };
  data: {
    user: NeteaseUserDetailResponse["profile"] | null;
    lastRefreshCookieDate: number | null;
    loginMode: "account" | "username" | "";
    _historyList: NeteaseTrack[];
  };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
  updatePlayHistory: (track: NeteaseTrack) => void;
  clearHistoryList: () => void;
  getHistoryListStatic: () => NeteaseTrack[];
}
