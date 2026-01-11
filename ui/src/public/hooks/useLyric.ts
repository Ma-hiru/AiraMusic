import { useCallback } from "react";
import { NeteaseLyric } from "@mahiru/ui/public/entry/lyric";

export function useLyric(
  lyricVersion: Optional<LyricVersionType>,
  setLyricVersion: NormalFunc<[version: LyricVersionType]>,
  lyricLines: Optional<FullVersionLyricLine>
) {
  const lyricInfos = NeteaseLyric.getLyricVersionInfo(lyricLines, lyricVersion);
  const setRm = useCallback(() => {
    if (!lyricInfos.hasRm) return;
    switch (lyricVersion) {
      case "full":
        setLyricVersion("tl");
        break;
      case "rm":
        setLyricVersion("raw");
        break;
      case "raw":
        setLyricVersion("rm");
        break;
      case "tl":
        setLyricVersion("full");
        break;
    }
  }, [lyricInfos.hasRm, lyricVersion, setLyricVersion]);
  const setTl = useCallback(() => {
    if (!lyricInfos.hasTl) return;
    switch (lyricVersion) {
      case "full":
        setLyricVersion("rm");
        break;
      case "tl":
        setLyricVersion("raw");
        break;
      case "raw":
        setLyricVersion("tl");
        break;
      case "rm":
        setLyricVersion("full");
        break;
    }
  }, [lyricInfos.hasTl, lyricVersion, setLyricVersion]);
  return {
    ...lyricInfos,
    setRm,
    setTl
  };
}
