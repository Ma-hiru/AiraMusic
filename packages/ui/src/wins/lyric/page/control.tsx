import React, {
  type FC,
  type HTMLAttributes,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { css, cx } from "@emotion/css";
import { AArrowDown, AArrowUp, LockKeyholeOpen, LucideLock } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseLyric, NeteaseNetworkImage } from "@/common/netease/models";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";

import Drag from "@/common/components/layout/drag/drag";
import NeteaseImage from "@/common/components/display/image/netease-image";
import NoDrag from "@/common/components/layout/drag/no-drag";
import Marquee from "@/common/components/display/marquee";

type ControlProps = Omit<HTMLAttributes<HTMLDivElement>, "color"> & {
  showBg: boolean;
  color?: string;
  fontSize: number;
  lock: boolean;
  rmActive: Optional<boolean>;
  tlActive: Optional<boolean>;
  lyric: Nullable<NeteaseLyric>;
  setColor: NormalFunc<[color?: string]>;
  setLock: NormalFunc<[lock: boolean]>;
  setFontSize: NormalFunc<[size: number]>;
};

const Control: FC<ControlProps> = ({
  showBg,
  color,
  lock,
  setLock,
  setColor,
  fontSize,
  setFontSize,
  lyric,
  rmActive,
  tlActive,
  ...rest
}) => {
  const playerBus = useListenable(RendererEventBus.player);
  const infoBus = useListenable(RendererEventBus.info);
  const progressBus = useListenable(RendererEventBus.progress);
  const [openColorSelect, setOpenColorSelect] = useState(false);

  const { rmExisted, tlExisted } = lyric?.info || {};
  const themeColor = infoBus.data?.theme.mainColor;
  const track = playerBus.data?.track?.detail;
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromTrackCover(track)?.setSize(NeteaseImageSize.xs).setAlt(track?.name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track?.id]
  );

  const upFontSize = useCallback(() => {
    setFontSize(Math.min(fontSize + 2, 72));
  }, [fontSize, setFontSize]);

  const downFontSize = useCallback(() => {
    setFontSize(Math.max(fontSize - 2, 14));
  }, [fontSize, setFontSize]);

  const setLyricVersion = useCallback(
    (version: "toggle-lyric-version-rm" | "toggle-lyric-version-tl") => {
      RendererEventBus.playerAction.send(version);
    },
    []
  );

  useEffect(() => {
    lock && RendererWindow.current.mousePenetrate(true);
  }, [lock]);

  useEffect(() => {
    if (!showBg) setOpenColorSelect(false);
  }, [showBg]);

  const lyricVersionIcon = useMemo(
    () =>
      [
        {
          label: "音",
          active: rmActive,
          existed: rmExisted,
          version: "toggle-lyric-version-rm"
        },
        {
          label: "译",
          active: tlActive,
          existed: tlExisted,
          version: "toggle-lyric-version-tl"
        }
      ] as const,
    [rmActive, rmExisted, tlActive, tlExisted]
  );

  return (
    <Drag
      className={cx(
        "w-screen px-2 py-1",
        showBg && "bg-black/40",
        css`
          color: ${color || themeColor || "#ffffff"};
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
            style={{ backgroundColor: color || themeColor || "#ffffff" }}>
            <NoDrag
              className="absolute top-full mt-2 flex justify-start items-center gap-1 ease-in-out duration-300 transition-opacity"
              style={{
                opacity: openColorSelect ? 1 : 0,
                pointerEvents: openColorSelect ? "auto" : "none"
              }}>
              {themeColor && (
                <NoDrag
                  className="size-4 rounded-sm cursor-pointer text-[8px] font-semibold"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => {
                    if (themeColor) {
                      setColor(undefined);
                      setOpenColorSelect(false);
                    }
                  }}
                />
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
          <NeteaseImage cache image={image} className="rounded-full size-5 shrink-0" />
          <Marquee
            className="text-[14px] font-semibold whitespace-nowrap max-w-[35vw]!"
            options={{
              speed: 15,
              pingPong: true,
              pauseOnHover: true,
              gapDuration: 2000
            }}>
            <span>{track?.name}</span>
            {track?.name && <span> - </span>}
            <span>{track?.ar.map((a) => a.name).join("/")}</span>
          </Marquee>
        </div>
        <div className="w-full flex items-center justify-end">
          <NoDrag>
            {lock ? (
              <LucideLock
                className="size-4 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                onClick={() => setLock(false)}
                onMouseOver={() => RendererWindow.current.mousePenetrate(false)}
                onMouseLeave={() => RendererWindow.current.mousePenetrate(true)}
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
            {lyricVersionIcon.map(({ label, active, existed, version }) => (
              <NoDrag
                key={label}
                onClick={() => setLyricVersion(version)}
                className={cx(
                  `
                  size-4 text-[11px] font-semibold
                  flex justify-center items-center overflow-hidden
                  rounded-xs backdrop-blur-lg cursor-pointer
                `,
                  existed ? "cursor-pointer" : "cursor-not-allowed",
                  active && existed ? "bg-white" : "bg-white/20",
                  color === "#FFFFFF" && "text-black"
                )}>
                {label}
              </NoDrag>
            ))}
          </div>
          <span className="text-[12px] font-semibold">
            {RendererFormat.duration(progressBus.data?.currentTime, "s")}
            {" / "}
            {RendererFormat.duration(progressBus.data?.duration, "s")}
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
