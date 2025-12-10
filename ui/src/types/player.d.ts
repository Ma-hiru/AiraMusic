type PlayerTrackInfo = {
  source: Nullable<number>;
  track: NeteaseTrack;
};

type PlayerTrackSource = {
  lyric: {
    version: LyricVersionType;
    data: FullVersionLyricLine;
  };
  audio: string;
  meta?: NeteaseSongUrlItem[];
};

type PlayerTrackStatus = PlayerTrackInfo & PlayerTrackSource;

type PlayerStatus = {
  playing: boolean;
  volume: number;
  volumeBeforeMute: number;
  repeat: "off" | "one" | "all";
  shuffle: boolean;
  position: number;
  lyricPreference: LyricVersionType | null;
};

type PlayerProgress = {
  currentTime: number;
  duration: number;
  buffered: number;
  size: number;
};

type LyricVersionType = "raw" | "full" | "tl" | "rm";
