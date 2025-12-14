import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { TrackQuality } from "@mahiru/ui/utils/track";

export const PersistStoreConfig: ZustandConfig<
  PersistStoreInitialState & PersistStoreActions,
  PersistStoreInitialState
> = (set, get) => ({
  ...InitialState,
  updatePersistStore(PartialState) {
    set((state) => {
      Object.entries(PartialState ?? {}).forEach(([key, value]) => {
        // @ts-expect-error
        state[key] = value;
      });
    });
  },
  updatePersistStoreData(PartialData) {
    set((state) => {
      Object.entries(PartialData ?? {}).forEach(([key, value]) => {
        // @ts-expect-error
        state.data[key] = value;
      });
    });
  },
  updateUserPlaylistSummary(summary) {
    set((state) => {
      state.userPlaylistSummary = summary;
    });
  },
  updateUserLikedListSummary(summary) {
    set((state) => {
      state.userLikedListSummary = summary;
    });
  },
  updateUserLikedTrackIDs(trackIDs) {
    set((state) => {
      state.userLikedTrackIDs = trackIDs;
    });
  },
  updateSettings(PartialSettings) {
    set((state) => {
      Object.entries(PartialSettings ?? {}).forEach(([key, value]) => {
        state.settings[key as keyof PersistStoreInitialState["settings"]] = value;
      });
    });
  }
});

const InitialState: PersistStoreInitialState = {
  settings: {
    musicQuality: TrackQuality.h,
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
    ids: {},
    checkPoint: 0
  }
};

export interface PersistStoreInitialState {
  settings: {
    musicQuality: TrackQuality;
    maxHistoryListLength: number;
  };
  data: {
    user: NeteaseUserDetailResponse["profile"] | null;
    lastRefreshCookieDate: number | null;
    loginMode: "account" | "username" | "";
  };
  userLikedListSummary: Nullable<NeteasePlaylistSummary>;
  userPlaylistSummary: Nullable<NeteasePlaylistSummary[]>;
  userLikedTrackIDs: { ids: Record<number, boolean>; checkPoint: number };
}

export interface PersistStoreActions {
  updatePersistStore: (PartialState: Partial<PersistStoreInitialState>) => void;
  updatePersistStoreData: (PartialData: Partial<PersistStoreInitialState["data"]>) => void;
  updateSettings: (PartialSettings: Partial<PersistStoreInitialState["settings"]>) => void;
  updateUserPlaylistSummary: (
    summary: Nullable<PersistStoreInitialState["userPlaylistSummary"]>
  ) => void;
  updateUserLikedListSummary: (
    summary: Nullable<PersistStoreInitialState["userLikedListSummary"]>
  ) => void;
  updateUserLikedTrackIDs: (trackIDs: PersistStoreInitialState["userLikedTrackIDs"]) => void;
}
