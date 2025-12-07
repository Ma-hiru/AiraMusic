import { LyricVersionType } from "@mahiru/ui/ctx/PlayerCtx";
import { useCallback } from "react";

export function useLyric(
  lyricVersion: LyricVersionType,
  setLyricVersion: NormalFunc<[version: LyricVersionType]>,
  lyricLines: FullVersionLyricLine
) {
  const hasRm = lyricLines.rm.length > 0;
  const hasTl = lyricLines.tl.length > 0;
  const rmActive = lyricVersion === "rm" || lyricVersion === "full";
  const tlActive = lyricVersion === "tl" || lyricVersion === "full";
  const setRm = useCallback(() => {
    if (!hasRm) return;
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
  }, [hasRm, lyricVersion, setLyricVersion]);
  const setTl = useCallback(() => {
    if (!hasTl) return;
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
  }, [hasTl, lyricVersion, setLyricVersion]);
  return {
    hasRm,
    hasTl,
    rmActive,
    tlActive,
    setRm,
    setTl
  };
}
