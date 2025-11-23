import React, { FC, memo, useCallback, HTMLAttributes, useRef } from "react";
import { cx, css } from "@emotion/css";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { formatCurrentTimeToMMSS } from "@mahiru/ui/utils/time";
import { useLyric } from "@mahiru/ui/hook/useLyric";
import { useManualAutoScroll } from "@mahiru/ui/hook/useMarquee";
import { LockKeyholeOpen, LucideLock } from "lucide-react";

type ControlProps = HTMLAttributes<HTMLDivElement> & {
  showBg: boolean;
  setShowBg: (show: boolean) => void;
  color: string;
  info: Nullable<LyricInit["info"]>;
  lyricSync: LyricSync;
  lyricLines: FullVersionLyricLine;
  lock: boolean;
  setLock: (lock: boolean) => void;
};

const Control: FC<ControlProps> = ({
  showBg,
  color,
  info,
  lyricLines,
  lyricSync,
  lock,
  setLock,
  setShowBg,
  ...rest
}) => {
  const setLyricVersion = useCallback((version: LyricVersionType) => {
    window.node.event.sendMessageTo({
      from: "lyric",
      to: "main",
      type: "lyricVersionChange",
      data: version
    });
  }, []);
  const { hasRm, hasTl, rmActive, tlActive, setRm, setTl } = useLyric(
    lyricSync.lyricVersion,
    setLyricVersion,
    lyricLines
  );
  const titleContainer = useRef<HTMLDivElement>(null);
  useManualAutoScroll(titleContainer, {
    speed: 15,
    auto: true,
    pingPong: true,
    pauseOnHover: true
  });

  return (
    <Drag
      className={cx(
        "w-screen px-2 py-1",
        showBg && "bg-black/40",
        css`
          color: ${color};
        `
      )}
      drag={showBg}
      {...rest}>
      <div className="w-full grid h-5 grid-rows-1 grid-cols-[1fr_auto_1fr] items-center select-none">
        <div />
        <div className="flex items-center gap-2">
          <img
            src={setImageURLSize(info?.cover, "xs")}
            alt={info?.title}
            className="rounded-full size-5 shrink-0"
          />
          <div
            ref={titleContainer}
            className={cx(
              "text-[14px] font-semibold whitespace-nowrap max-w-[50vw] overflow-x-scroll",
              css`
                scrollbar-width: none;
              `
            )}>
            <span>{info?.title}</span>
            {info?.title && <span> - </span>}
            <span>{info?.artist.map((a) => a.name).join("/")}</span>
          </div>
        </div>
        <div className="w-full flex items-center justify-end gap-4">
          <div className="text-white">
            {lock ? (
              <LockKeyholeOpen className="size-4 cursor-pointer" onClick={() => setLock(false)} />
            ) : (
              <LucideLock className="size-4 cursor-pointer" onClick={() => setLock(true)} />
            )}
          </div>
          <div className="text-white flex gap-2">
            <span
              onClick={setRm}
              className={cx(
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg cursor-pointer",
                {
                  "bg-white text-black ": rmActive && hasRm,
                  "bg-white/20 ": !rmActive || !hasRm,
                  "cursor-not-allowed": !hasRm,
                  "cursor-pointer": hasRm
                }
              )}>
              音
            </span>
            <span
              onClick={setTl}
              className={cx(
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg cursor-pointer",
                {
                  "bg-white text-black ": tlActive && hasTl,
                  "bg-white/20": !tlActive || !hasTl,
                  "cursor-not-allowed": !hasTl,
                  "cursor-pointer": hasTl
                }
              )}>
              译
            </span>
          </div>
          <span className="text-[12px] font-semibold">
            {formatCurrentTimeToMMSS(lyricSync?.currentTime)} /{" "}
            {formatCurrentTimeToMMSS(lyricSync?.duration)}
          </span>
        </div>
      </div>
    </Drag>
  );
};
export default memo(Control);
