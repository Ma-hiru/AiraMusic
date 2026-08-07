import { cx } from "@emotion/css";
import { memo, useRef, type FC, useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLyricSyncFromBus } from "@/common/hooks/use-lyric-sync-from-bus";
import { useStableLyricInstanceFromBus } from "@/common/hooks/use-stable-lyric-instance-from-bus";
import NoDrag from "@/common/components/layout/drag/no-drag";
import LyricComponent, { type LyricRef } from "@/common/components/display/lyric";

interface RadioLyricProps {
  className?: string;
}

const RadioLyric: FC<RadioLyricProps> = ({ className }) => {
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const progressBusRef = useLatestRef(useListenable(RendererIPCMessageBus.progress).data);
  const lyricRef = useRef<Nullable<LyricRef>>(null);
  // 歌词稳定的实例
  const lyric = useStableLyricInstanceFromBus(trackMetaBus.data?.lyric);
  // 歌词播放同步
  useLyricSyncFromBus(lyricRef);
  // 点击歌词跳转
  const handleWordClick = useCallback(
    (timeMS: number) => {
      RendererIPCMessageBus.playlistAction.deliver({
        type: "lyricJump",
        timeMS: timeMS > (progressBusRef.current?.currentTime ?? 0) * 1000 ? timeMS + 200 : timeMS
      });
    },
    [progressBusRef]
  );

  return (
    <NoDrag className={cx(className, "contain-strict")}>
      <LyricComponent
        ref={lyricRef}
        className="contain-strict space-y-1!"
        fontSize={16}
        lyric={lyric}
        rmActive={trackMetaBus.data?.rmActive}
        tlActive={trackMetaBus.data?.tlActive}
        noteActive={trackMetaBus.data?.noteActive}
        playing={trackMetaBus.data?.status === "playing"}
        onWordClick={handleWordClick}
      />
    </NoDrag>
  );
};

export default memo(RadioLyric);
