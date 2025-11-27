import { ZustandConfig } from "@mahiru/ui/types/zustand";
import {
  NeteasePlaylistDetailResponse,
  NeteasePlaylistSummary
} from "@mahiru/ui/types/netease-api";

const playList = new Map<number, NeteasePlaylistDetailResponse>();
const userPlayLists: NeteasePlaylistSummary[] = [];

export const DynamicStoreConfig: ZustandConfig<
  DynamicStoreInitialState & DynamicStoreActions,
  DynamicStoreInitialState
> = (set, get) => ({
  ...InitialState,
  getPlayListStatic: () => playList,
  getUserPlayListSummaryStatic: () => userPlayLists,
  updateLikedTrackIDs: (ids: Set<number>, checkPoint: number) => {
    set((draft) => {
      draft.likedTrackIDs.ids = ids;
      draft.likedTrackIDs.checkPoint = checkPoint;
    });
  },
  updateUserLikedPlayList: (liked: Nullable<NeteasePlaylistSummary>) => {
    set((draft) => {
      draft.userLikedPlayList = liked;
    });
  },
  updateTrigger: () => {
    set((draft) => {
      draft._update += 1;
    });
  }
});

const InitialState: DynamicStoreInitialState = {
  _update: 0,
  userLikedPlayList: null,
  likedTrackIDs: {
    ids: new Set<number>(),
    checkPoint: 0
  }
};

export interface DynamicStoreInitialState {
  _update: number;
  userLikedPlayList: Nullable<NeteasePlaylistSummary>;
  likedTrackIDs: {
    ids: Set<number>;
    checkPoint: number;
  };
}

export type DynamicStoreActions = {
  updateLikedTrackIDs: (ids: Set<number>, checkPoint: number) => void;
  updateUserLikedPlayList: (liked: Nullable<NeteasePlaylistSummary>) => void;
  getUserPlayListSummaryStatic: () => NeteasePlaylistSummary[];
  getPlayListStatic: () => Map<number, NeteasePlaylistDetailResponse>;
  updateTrigger: () => void;
};
