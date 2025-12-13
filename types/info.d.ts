type InfoSync = {
  type: "musicInfo" | "search" | "artist" | "album" | "none";
  value: string | number;
  background?: string;
  mainColor: string;
  secondaryColor: string;
  textColor: string;
};
