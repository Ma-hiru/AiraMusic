export const DynamicStoreConfig: ZustandConfig<
  DynamicStoreInitialState & DynamicStoreActions,
  DynamicStoreInitialState
> = (set, get) => ({
  ...InitialState
});

const InitialState: DynamicStoreInitialState = {
  showLyrics: false,
  enableScrolling: true,
  title: "simple-cloud-music",
  liked: {
    songs: [],
    /** 只有前12首 */
    songsWithDetails: [],
    playlists: [],
    albums: [],
    artists: [],
    mvs: [],
    cloudDisk: [],
    playHistory: {
      weekData: [],
      allData: []
    }
  },
  dailyTracks: []
};

export interface DynamicStoreInitialState {
  showLyrics: boolean;
  enableScrolling: boolean;
  title: string;
  liked: {
    songs: number[];
    /** 只有前12首 */
    songsWithDetails: any[];
    playlists: number[];
    albums: number[];
    artists: number[];
    mvs: number[];
    cloudDisk: number[];
    playHistory: {
      weekData: any[];
      allData: any[];
    };
  };
  dailyTracks: any[];
}

export type DynamicStoreActions = object;
