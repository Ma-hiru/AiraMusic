import { ZustandConfig } from "@mahiru/ui/types/zustand";

export const UserStoreConfig: ZustandConfig<
  UserStoreInitialState & UserStoreActions,
  UserStoreInitialState
> = (set, get) => ({
  ...InitialState,
  UpdateUserProfile: (profile, mode) => {
    set((draft) => {
      draft.UserProfile = profile;
      draft.UserLoginMode = mode;
    });
  },
  UpdateUserPlaylistSummary: (summary) => {
    set((draft) => {
      draft.UserPlaylistSummary = summary;
    });
  },
  UpdateUserLikedListSummary: (summary) => {
    set((draft) => {
      draft.UserLikedListSummary = summary;
    });
  },
  UpdateUserLikedTrackIDs: (trackIDs) => {
    set((draft) => {
      draft.UserLikedTrackIDs = trackIDs;
    });
  },
  UpdateUserLastRefreshCookieDate: (date) => {
    set((draft) => {
      draft.UserLastRefreshCookieDate = date;
    });
  }
});

const InitialState: UserStoreInitialState = {
  UserProfile: null,
  UserLoginMode: "",
  UserLikedListSummary: null,
  UserPlaylistSummary: null,
  UserLikedTrackIDs: { ids: {}, checkPoint: 0 },
  UserLastRefreshCookieDate: null
};

export type UserStoreInitialState = {
  UserProfile: Nullable<NeteaseUserDetailResponse["profile"]>;
  UserLoginMode: "account" | "username" | "";
  UserLikedListSummary: Nullable<NeteasePlaylistSummary>;
  UserPlaylistSummary: Nullable<NeteasePlaylistSummary[]>;
  UserLikedTrackIDs: { ids: Record<number, boolean>; checkPoint: number };
  UserLastRefreshCookieDate: Nullable<number>;
};

export type UserStoreActions = {
  UpdateUserProfile: NormalFunc<
    [
      profile: UserStoreInitialState["UserProfile"],
      loginMode: UserStoreInitialState["UserLoginMode"]
    ]
  >;
  UpdateUserPlaylistSummary: NormalFunc<[summary: UserStoreInitialState["UserPlaylistSummary"]]>;
  UpdateUserLikedListSummary: NormalFunc<[summary: UserStoreInitialState["UserLikedListSummary"]]>;
  UpdateUserLikedTrackIDs: NormalFunc<[trackIDs: UserStoreInitialState["UserLikedTrackIDs"]]>;
  UpdateUserLastRefreshCookieDate: NormalFunc<
    [date: UserStoreInitialState["UserLastRefreshCookieDate"]]
  >;
};
