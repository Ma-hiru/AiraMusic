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
  },
  updateUserPlaylistSummary(summary: Nullable<PersistStoreInitialState["userPlaylistSummary"]>) {
    set((state) => {
      state.userPlaylistSummary = summary;
    });
  },
  updateUserLikedListSummary(summary: Nullable<PersistStoreInitialState["userLikedListSummary"]>) {
    set((state) => {
      state.userLikedListSummary = summary;
    });
  },
  updateUserLikedTrackIDs(trackIDs: PersistStoreInitialState["userLikedTrackIDs"]) {
    set((state) => {
      state.userLikedTrackIDs = trackIDs;
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
  },
  userPlaylistSummary: null,
  userLikedListSummary: null,
  userLikedTrackIDs: {
    ids: new Set<number>(),
    checkPoint: 0
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
  userLikedListSummary: Nullable<NeteasePlaylistSummary>;
  userPlaylistSummary: Nullable<NeteasePlaylistSummary[]>;
  userLikedTrackIDs: { ids: Set<number>; checkPoint: number };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
  updateUserPlaylistSummary: (
    summary: Nullable<PersistStoreInitialState["userPlaylistSummary"]>
  ) => void;
  updateUserLikedListSummary: (
    summary: Nullable<PersistStoreInitialState["userLikedListSummary"]>
  ) => void;
  updateUserLikedTrackIDs: (trackIDs: PersistStoreInitialState["userLikedTrackIDs"]) => void;
}
