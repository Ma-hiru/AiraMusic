type ThemeSync = {
  mainColor: string;
  secondaryColor: string;
  textColorOnMain: string;
  KMeansColor: string[];
  backgroundImage: Undefinable<string>;
};

type PlayerStatusSync = {
  volume: number;
  repeat: "off" | "one" | "all";
  shuffle: boolean;
  position: number;
  fsmState: number;
  lyricPreference: LyricVersionType | null;
  lyricVersion: LyricVersionType;
};

type PlayerControlSync = "play" | "pause" | "next" | "last" | "mute" | "exit" | "openInfoWindow";
