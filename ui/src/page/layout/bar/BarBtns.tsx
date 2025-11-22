import { FC, memo, useCallback, useEffect, useState } from "react";
import { cx } from "@emotion/css";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const BarBtns: FC<object> = () => {
  const [hasOpenLyricWin, setHasOpenLyricWin] = useState(false);
  const { lyricVersion, lyricLines, getProgress, isPlaying } = usePlayer();
  const openLyricWin = useCallback(() => {
    if (!hasOpenLyricWin) {
      window.node.event.createLyricWindow();
      setTimeout(() => {
        window.node.event.sendMessageTo({
          from: "main",
          to: "lyric",
          type: "lyricInit",
          data: JSON.stringify({
            lyricLines
          } as LyricInit)
        });
      }, 2000);
      setHasOpenLyricWin(true);
    } else {
      window.node.event.close("lyric");
      setHasOpenLyricWin(false);
    }
  }, [hasOpenLyricWin, lyricLines]);
  useEffect(() => {
    if (!hasOpenLyricWin) return;
    const sendSyncInfo = () => {
      const { currentTime, duration } = getProgress();
      window.node.event.sendMessageTo({
        from: "main",
        to: "lyric",
        type: "lyricSync",
        data: JSON.stringify({
          lyricVersion,
          currentTime,
          duration,
          isPlaying
        } as LyricSync)
      });
    };
    const timer = setInterval(sendSyncInfo, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [getProgress, hasOpenLyricWin, isPlaying, lyricVersion]);
  useEffect(() => {
    window.node.event.sendMessageTo({
      from: "main",
      to: "lyric",
      type: "lyricInit",
      data: JSON.stringify({
        lyricLines
      } as LyricInit)
    });
  }, [lyricLines]);
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <span
        onClick={openLyricWin}
        className={cx("size-5 font-semibold hover:opacity-50 select-none cursor-pointer", {
          "text-[#fc3d49]": hasOpenLyricWin
        })}>
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
