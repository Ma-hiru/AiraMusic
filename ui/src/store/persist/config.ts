import { ZustandConfig } from "@mahiru/ui/types/zustand";

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
    musicQuality: 320000,
    maxHistoryListLength: 500
  },
  data: {
    user: null,
    lastRefreshCookieDate: null,
    loginMode: ""
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
  };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
}
