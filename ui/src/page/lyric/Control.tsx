import React, { FC, HTMLAttributes, memo, useCallback, useEffect, useRef, useState } from "react";
import { css, cx } from "@emotion/css";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import { useLyric } from "@mahiru/ui/hook/useLyric";
import { useManualAutoScroll } from "@mahiru/ui/hook/useMarquee";
import { AArrowDown, AArrowUp, LockKeyholeOpen, LucideLock } from "lucide-react";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { Time } from "@mahiru/ui/utils/time";

type FontSize = `${number}px` | `${number}rem` | `${number}em`;

type ControlProps = Omit<HTMLAttributes<HTMLDivElement>, "color"> & {
  showBg: boolean;
  setShowBg: (show: boolean) => void;
  color?: string;
  setColor: (color?: string) => void;
  lyricSync?: LyricSync;
  lyricInit?: LyricInit;
  lock: boolean;
  setLock: (lock: boolean) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
};

const Control: FC<ControlProps> = ({
  showBg,
  color,
  lyricSync,
  lyricInit,
  lock,
  setLock,
  setColor,
  fontSize,
  setFontSize,
  ...rest
}) => {
  const track = lyricInit?.trackStatus?.track;
  const [openColorSelect, setOpenColorSelect] = useState(false);
  const titleContainer = useRef<HTMLDivElement>(null);

  const upFontSize = useCallback(() => {
    const currentSize = parseInt(fontSize.replace("px", ""), 10);
    const newSize = Math.min(currentSize + 2, 72);
    setFontSize(`${newSize}px`);
  }, [fontSize, setFontSize]);

  const downFontSize = useCallback(() => {
    const currentSize = parseInt(fontSize.replace("px", ""), 10);
    const newSize = Math.max(currentSize - 2, 16);
    setFontSize(`${newSize}px`);
  }, [fontSize, setFontSize]);

  const setLyricVersion = useCallback((version: LyricVersionType) => {
    Renderer.sendMessage("lyricSyncReverse", "main", {
      playerStatus: {
        lyricVersion: version
      }
    });
  }, []);

  const { hasRm, hasTl, rmActive, tlActive, setRm, setTl } = useLyric(
    lyricSync?.playerStatus.lyricVersion,
    setLyricVersion,
    lyricInit?.trackStatus.lyric
  );
  useManualAutoScroll(titleContainer, {
    speed: 10,
    auto: true,
    pingPong: true,
    pauseOnHover: true,
    gapDuration: 2000
  });

  useEffect(() => {
    lock && Renderer.event.mousePenetrate(true);
  }, [lock]);

  useEffect(() => {
    if (!showBg) setOpenColorSelect(false);
  }, [showBg]);

  return (
    <Drag
      className={cx(
        "w-screen px-2 py-1",
        showBg && "bg-black/40",
        css`
          color: ${color || lyricSync?.themeColor || "#ffffff"};
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
          <NoDrag
            onClick={() => setOpenColorSelect(!openColorSelect)}
            className="relative size-4 rounded-sm cursor-pointer mr-1"
            style={{ backgroundColor: color || lyricSync?.themeColor || "#ffffff" }}>
            <NoDrag
              className="absolute top-full mt-2 flex justify-start items-center gap-1 ease-in-out duration-300 transition-opacity"
              style={{
                opacity: openColorSelect ? 1 : 0,
                pointerEvents: openColorSelect ? "auto" : "none"
              }}>
              {lyricSync?.themeColor && (
                <NoDrag
                  className="size-4 rounded-sm cursor-pointer text-[8px] font-semibold"
                  style={{ backgroundColor: lyricSync.themeColor }}
                  onClick={() => {
                    if (lyricSync.themeColor) {
                      setColor(undefined);
                      setOpenColorSelect(false);
                    }
                  }}>
                  主
                </NoDrag>
              )}
              {presetColors.map((presetColor) => {
                if (presetColor === color) return null;
                return (
                  <NoDrag
                    className="size-4 rounded-sm cursor-pointer"
                    key={presetColor}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => {
                      setColor(presetColor);
                      setOpenColorSelect(false);
                    }}
                  />
                );
              })}
            </NoDrag>
          </NoDrag>
          <NoDrag>
            <AArrowUp
              onClick={upFontSize}
              className="size-5 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
            />
          </NoDrag>
          <NoDrag>
            <AArrowDown
              onClick={downFontSize}
              className="size-5 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
            />
          </NoDrag>
        </div>
        <div className="flex items-center gap-2">
          <img
            src={Filter.NeteaseImageSize(track?.al.cachedPicUrl || track?.al.picUrl, ImageSize.xs)}
            loading="lazy"
            decoding="async"
            alt={track?.name}
            className="rounded-full size-5 shrink-0"
          />
          <div
            ref={titleContainer}
            className={cx(
              "text-[14px] font-semibold whitespace-nowrap max-w-[35vw] overflow-x-scroll",
              css`
                scrollbar-width: none;
              `
            )}>
            <span>{track?.name}</span>
            {track?.name && <span> - </span>}
            <span>{track?.ar.map((a) => a.name).join("/")}</span>
          </div>
        </div>
        <div className="w-full flex items-center justify-end">
          <NoDrag>
            {lock ? (
              <LucideLock
                className="size-4 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                onClick={() => setLock(false)}
                onMouseOver={() => Renderer.event.mousePenetrate(false)}
                onMouseLeave={() => Renderer.event.mousePenetrate(true)}
              />
            ) : (
              <LockKeyholeOpen
                className="size-4 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                onClick={() => setLock(true)}
              />
            )}
          </NoDrag>
          <div
            className="flex gap-2 mx-2 ease-in-out duration-300 transition-all"
            style={{ width: lock ? 0 : "auto" }}>
            <NoDrag
              onClick={setRm}
              className={cx(
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-xs backdrop-blur-lg cursor-pointer",
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
                "size-4 text-[11px] font-semibold flex justify-center items-center overflow-hidden rounded-xs backdrop-blur-lg cursor-pointer",
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
            {Time.formatTrackTime(lyricSync?.progress?.currentTime, "s")}
            {" / "}
            {Time.formatTrackTime(lyricSync?.progress?.duration, "s")}
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
