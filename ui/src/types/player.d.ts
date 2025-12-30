type PlayerTrackInfo = {
  source: Nullable<number>;
  track: NeteaseTrack;
};

type PlayerTrackSource = {
  lyric: FullVersionLyricLine;
  audio: string;
  quality: Undefinable<NeteaseQualityLevels & { level: number }>;
  meta?: NeteaseSongUrlItem[];
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
  size: number;
};

type LyricVersionType = "raw" | "full" | "tl" | "rm";

type LayoutCanScrollTop =
  | "none"
  | "home"
  | "playlist"
  | "userPlaylist"
  | "album"
  | "artist"
  | "search";
