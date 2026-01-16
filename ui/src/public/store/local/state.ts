import { TrackQuality } from "@mahiru/ui/public/enum";

export const version = 1;

export interface LocalStoreStateBase {
  version: number;
}

export interface _V1 extends LocalStoreStateBase {
  User: {
    LastRefreshCookiesDay: Nullable<number>;
    UserProfile: Nullable<NeteaseUserDetailResponse["profile"]>;
    UserLoginMode: Nullable<"account" | "username">;
    UserLikedTrackIDs: { ids: Record<number, boolean>; checkPoint: number };
    UserLikedPlaylistID: Nullable<number>;
  };
  Settings: {
    MusicQuality: TrackQuality;
    MaxHistoryListLength: number;
  };
}

export type LocalStoreState = _V1;

export function defaultState(): LocalStoreState {
  return {
    User: {
      LastRefreshCookiesDay: null,
      UserProfile: null,
      UserLoginMode: null,
      UserLikedTrackIDs: { ids: {}, checkPoint: 0 },
      UserLikedPlaylistID: null
    },
    Settings: {
      MusicQuality: TrackQuality.h,
      MaxHistoryListLength: 500
    },
    version
  };
}
