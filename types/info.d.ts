type InfoSync = {
  type: "musicInfo" | "search" | "artist" | "album" | "none";
  id: string | number;
  background?: string;
  mainColor: string;
  secondaryColor: string;
  textColor: string;
};
