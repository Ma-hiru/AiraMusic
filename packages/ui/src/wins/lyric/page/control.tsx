import { cx, css } from "@emotion/css";
import { X, AArrowUp, AArrowDown, LucideLock, LockKeyholeOpen } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseLyric, NeteaseNetworkImage } from "@/common/netease/models";
import React, {
  memo,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type HTMLAttributes
} from "react";
import Drag from "@/common/components/layout/drag/drag";
import Marquee from "@/common/components/display/marquee";
import NoDrag from "@/common/components/layout/drag/no-drag";
import NeteaseImage from "@/common/components/display/image/netease-image";

type ControlProps = Omit<HTMLAttributes<HTMLDivElement>, "color"> & {
  lock: boolean;
  color?: string;
  showBg: boolean;
  fontSize: number;
  themeColor?: string;
  controlReverse?: boolean;
  rmActive: Optional<boolean>;
  tlActive: Optional<boolean>;
  lyric: Nullable<NeteaseLyric>;
  setLock: NormalFunc<[lock: boolean]>;
  setColor: NormalFunc<[color?: string]>;
  setFontSize: NormalFunc<[size: number]>;
};

const Control: FC<ControlProps> = ({
  setLock,
  setColor,
  setFontSize,
  lock,
  color,
  lyric,
  showBg,
  fontSize,
  rmActive,
  tlActive,
  themeColor,
  controlReverse,
  ...rest
}) => {
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const progressBus = useListenable(RendererIPCMessageBus.progress);
  const [openColorSelect, setOpenColorSelect] = useState(false);
  const { rmExisted, tlExisted } = lyric?.info || {};
  const track = trackMetaBus.data?.track?.detail;
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
      RendererIPCMessageBus.playerAction.deliver(version);
    },
    []
  );

  useEffect(() => {
    lock && RendererWindow.current.penetrate(true);
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
        "w-screen px-2 py-1 rounded-md",
        showBg && "bg-primary-text/40",
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
            className="relative size-4 rounded-sm cursor-pointer mr-1"
            style={{ backgroundColor: color || themeColor || "#ffffff" }}
            onClick={() => setOpenColorSelect(!openColorSelect)}>
            <NoDrag
              className={cx(
                `
                absolute top-full mt-2 flex
                justify-start items-center gap-1
                ease-in-out duration-300 transition-opacity
              `,
                controlReverse && "-mt-10!"
              )}
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
                    key={presetColor}
                    className="size-4 rounded-sm cursor-pointer"
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
              className="size-5 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
              onClick={upFontSize}
            />
          </NoDrag>
          <NoDrag>
            <AArrowDown
              className="size-5 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
              onClick={downFontSize}
            />
          </NoDrag>
        </div>
        <div className="flex items-center gap-2">
          <NeteaseImage className="rounded-full size-5 shrink-0" image={image} cache />
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
          <span className="text-[12px] font-semibold">
            {RendererFormat.duration(progressBus.data?.currentTime, "s")}
            {" / "}
            {RendererFormat.duration(progressBus.data?.duration, "s")}
          </span>
          <NoDrag
            className="flex gap-2 ml-2 ease-in-out duration-300 transition-all"
            style={{ width: lock ? 0 : "auto" }}>
            {lyricVersionIcon.map(({ label, active, existed, version }) => (
              <span
                key={label}
                className={cx(
                  `
                  size-3.5 text-[11px] font-semibold
                  flex justify-center items-center overflow-hidden
                  rounded-xs backdrop-blur-lg cursor-pointer
                `,
                  existed ? "cursor-pointer" : "cursor-not-allowed",
                  active && existed ? "bg-white" : "bg-white/20",
                  color === "#FFFFFF" && "text-black"
                )}
                onClick={() => setLyricVersion(version)}>
                {label}
              </span>
            ))}
          </NoDrag>
          <NoDrag className="flex ml-2 gap-1 items-center">
            {lock ? (
              <LucideLock
                className="size-4 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                onClick={() => setLock(false)}
                onMouseLeave={() => RendererWindow.current.penetrate(true)}
                onMouseOver={() => RendererWindow.current.penetrate(false)}
              />
            ) : (
              <>
                <LockKeyholeOpen
                  className="size-3.5 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                  onClick={() => setLock(true)}
                />
                <X
                  className="size-4 cursor-pointer hover:opacity-50 duration-300 ease-in-out transition-all active:scale-90"
                  onClick={() => RendererWindow.current.close()}
                />
              </>
            )}
          </NoDrag>
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
