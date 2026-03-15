type PlayerTrackInfo = {
  source: Nullable<number>;
  track: NeteaseAPI.NeteaseTrack;
};

type PlayerTrackSource = {
  lyric: FullVersionLyricLine;
  audio: string;
  quality: Undefinable<NeteaseAPI.NeteaseQualityLevels & { level: number }>;
  meta?: NeteaseAPI.NeteaseSongUrlItem[];
};

type PlayerTrackStatus = PlayerTrackInfo & PlayerTrackSource;

type PlayerStatus = {
  volume: number;
  repeat: "off" | "one" | "all";
  shuffle: boolean;
  position: number;
  playerList: PlayerTrackStatus[];
  lyricPreference: LyricVersionType | null;
  lyricVersion: LyricVersionType;
};

type PlayerProgress = {
  currentTime: number;
  duration: number;
  buffered: number;
};

type LayoutCanScrollTop =
  | "none"
  | "home"
  | "playlist"
  | "userPlaylist"
  | "album"
  | "artist"
  | "search";
