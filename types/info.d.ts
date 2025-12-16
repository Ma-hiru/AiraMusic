type CommentsValue =
  | {
      /** 歌曲 */
      type: 0;
      id: number;
      track: NeteaseTrack;
    }
  | {
      /** 歌单 */
      type: 2;
      id: number;
      playlist: NeteasePlaylistDetail;
    }
  | {
      /** 专辑 */
      type: 3;
      id: number;
    };

type InfoSyncValueMap = {
  comments: CommentsValue;
  search: string;
  artist: number;
  album: number;
  none: undefined;
  theme: {
    mainColor: string;
    secondaryColor: string;
    textColor: string;
    backgroundImage: Undefinable<string>;
  };
};

type InfoSyncType = keyof InfoSyncValueMap;

type InfoSync<T extends InfoSyncType> = {
  type: T;
  value: InfoSyncValueMap[T];
};

type InfoSyncReverse = {
  displayType?: "static" | "subscribe";
};
