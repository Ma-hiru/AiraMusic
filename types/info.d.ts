type InfoSyncValueMap = {
  comments: {
    type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    id: number;
    track: NeteaseTrack;
  };
  search: string;
  artist: number;
  album: number;
  none: undefined;
};

type InfoSyncType = keyof InfoSyncValueMap;

type InfoSync<T extends InfoSyncType> = {
  type: T;
  value: InfoSyncValueMap[T];
  mainColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundImage: Undefinable<string>;
};
