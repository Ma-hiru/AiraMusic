import React, { FC, memo, useCallback, HTMLAttributes, useRef, useEffect } from "react";
import { cx, css } from "@emotion/css";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import { formatCurrentTimeToMMSS } from "@mahiru/ui/utils/time";
import { useLyric } from "@mahiru/ui/hook/useLyric";
import { useManualAutoScroll } from "@mahiru/ui/hook/useMarquee";
import { LockKeyholeOpen, LucideLock } from "lucide-react";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

type ControlProps = HTMLAttributes<HTMLDivElement> & {
  showBg: boolean;
  setShowBg: (show: boolean) => void;
  color: string;
  setColor: (color: string) => void;
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
  setColor,
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
  useEffect(() => {
    if (lock) {
      window.node.event.mousePenetrate({
        win: "lyric",
        penetrate: true
      });
    }
  }, [lock]);
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
        <div
          className={cx(
            "w-full h-full flex justify-start items-center gap-2",
            showBg ? "opacity-100" : "opacity-0"
          )}>
          {presetColors.map((presetColor) => {
            if (presetColor === color) return null;
            return (
              <NoDrag
                className="size-4 rounded-sm cursor-pointer"
                key={presetColor}
                style={{ backgroundColor: presetColor }}
                onClick={() => setColor(presetColor)}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <img
            src={NeteaseImageSizeFilter(info?.cover, ImageSize.xs)}
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
          <NoDrag>
            {lock ? (
              <LockKeyholeOpen
                className="size-4 cursor-pointer"
                onClick={() => setLock(false)}
                onMouseOver={() => {
                  window.node.event.mousePenetrate({
                    win: "lyric",
                    penetrate: false
                  });
                }}
                onMouseLeave={() => {
                  window.node.event.mousePenetrate({
                    win: "lyric",
                    penetrate: true
                  });
                }}
              />
            ) : (
              <LucideLock className="size-4 cursor-pointer" onClick={() => setLock(true)} />
            )}
          </NoDrag>
          <div className="flex gap-2">
            <NoDrag
              onClick={setRm}
              className={cx(
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg cursor-pointer",
                {
                  "bg-white": rmActive && hasRm,
                  "text-black": color === "#FFFFFF",
                  "bg-white/20 ": !rmActive || !hasRm,
                  "cursor-not-allowed": !hasRm,
                  "cursor-pointer": hasRm
                }
              )}>
              音
            </NoDrag>
            <NoDrag
              onClick={setTl}
              className={cx(
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-[2px] backdrop-blur-lg cursor-pointer",
                {
                  "bg-white": tlActive && hasTl,
                  "text-black": color === "#FFFFFF",
                  "bg-white/20": !tlActive || !hasTl,
                  "cursor-not-allowed": !hasTl,
                  "cursor-pointer": hasTl
                }
              )}>
              译
            </NoDrag>
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

const presetColors = [
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#008000",
  "#000000"
];
