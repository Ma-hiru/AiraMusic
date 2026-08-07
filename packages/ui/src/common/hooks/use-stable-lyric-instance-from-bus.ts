import { useRef, useState, useEffect } from "react";
import { NeteaseLyric } from "@/common/netease/models";

export function useStableLyricInstanceFromBus(
  lyricData: Optional<NeteaseLyric | NeteaseLyricModel>
) {
  const [lyric, setLyric] = useState<Nullable<NeteaseLyric>>(null);
  const lyricKey = useRef("");

  useEffect(() => {
    if (!lyricData) return setLyric(null);
    const newLyric = new NeteaseLyric(lyricData);
    if (newLyric.key === lyricKey.current) return;
    lyricKey.current = newLyric.key;
    setLyric(newLyric);
  }, [lyricData]);

  return lyric;
}
