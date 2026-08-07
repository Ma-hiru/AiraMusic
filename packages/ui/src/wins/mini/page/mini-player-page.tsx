import { cx } from "@emotion/css";
import { memo, type FC, useMemo, Fragment, useEffect, useCallback } from "react";
import {
  X,
  Play,
  Disc3,
  Pause,
  Music2,
  SkipBack,
  SkipForward,
  type LucideIcon
} from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseURL, NeteaseNetworkImage } from "@/common/netease/models";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import Drag from "@/common/components/layout/drag/drag";
import Marquee from "@/common/components/display/marquee";
import NoDrag from "@/common/components/layout/drag/no-drag";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const MiniPlayerPage: FC = () => {
  const themeBus = useThemeInjectFromBus();
  const mainWindow = useListenable(RendererWindow.main);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const progressBus = useListenable(RendererIPCMessageBus.progress);

  const track = trackMetaBus.data?.track?.detail;
  const album = trackMetaBus.data?.track?.detail.al;
  const isPlaying = trackMetaBus.data?.status === "playing";
  const bg = useMemo(
    () => NeteaseURL.setImageSize(track?.al.picUrl, NeteaseImageSize.sm),
    [track?.al.picUrl]
  );
  const cover = useMemo(() => {
    return NeteaseNetworkImage.fromTrackCover(track)?.setSize(NeteaseImageSize.sm);
  }, [track]);

  const close = useCallback(() => {
    RendererWindow.current.hide();
    RendererWindow.main.show();
    RendererWindow.main.focus();
  }, []);

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta");
    RendererIPCMessageBus.updater.deliver("track-progress");
  }, []);

  useEffect(() => {
    return mainWindow.addEventListener("show", () => {
      RendererWindow.current.hide();
    });
  }, [mainWindow]);

  const marqueeOpts = {
    speed: 10,
    pingPong: true,
    pauseOnHover: true,
    gapDuration: 2000
  };

  return (
    <Drag className={cx("relative overflow-hidden", !bg && "text-black")}>
      <section className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          className="absolute inset-0"
          src={bg}
          blur={10}
          opacity={1}
          saturate={2}
          brightness={0.6}
          themeColors={themeBus.data?.theme.themeColors}
        />
      </section>
      <section className="h-screen w-screen grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 z-10">
        <NoDrag className="relative size-11 rounded-md border overflow-hidden border-white/30 bg-primary/30">
          {cover ? (
            <NeteaseImage
              className="
                size-full hover:opacity-50 cursor-pointer
                ease-in-out duration-300 transition-opacity
              "
              image={cover}
              shadow="none"
              cacheLazy={false}
              imageClassName="object-cover"
              onClick={async () => {
                if (!cover) return;
                const image = cover.toNetworkImage().setSize(NeteaseImageSize.raw);
                await RendererWindow.image.reactReadyAwait();
                RendererIPCMessageBus.preview.deliver({
                  url: image.src,
                  alt: image.alt
                });
              }}
              cache
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music2 className="size-5" />
            </div>
          )}
          <span className="absolute right-0.5 top-0.5 flex size-2.5 items-center justify-center rounded-full bg-primary">
            <Disc3
              className={cx(
                "size-2 text-primary-text",
                trackMetaBus.data?.status === "playing" && "animate-spin"
              )}
            />
          </span>
        </NoDrag>
        <div className="grid min-w-0 grid-rows-[1fr_auto] gap-0.5">
          <div className="min-w-0 self-end">
            <Marquee
              className="text-[12px] font-semibold leading-4"
              options={marqueeOpts}
              text={trackMetaBus.data?.track?.name || "暂无播放"}
            />
            <Marquee
              className="text-[9px] font-semibold leading-3 opacity-80"
              options={marqueeOpts}>
              <span>
                {trackMetaBus.data?.track?.detail.ar.map((a, index) => {
                  return (
                    <Fragment key={a.id}>
                      <NoDrag
                        className="
                            inline cursor-pointer hover:opacity-50
                            ease-in-out duration-300 transition-all
                          "
                        title={a.name}
                        onClick={async () => {
                          await RendererWindow.display.reactReadyAwait();
                          RendererIPCMessageBus.display.deliver({
                            type: "artist",
                            id: a.id
                          });
                        }}>
                        {a.name}
                      </NoDrag>
                      {index !== (trackMetaBus.data?.track?.detail.ar.length ?? 0) - 1 && (
                        <span> / </span>
                      )}
                    </Fragment>
                  );
                })}
              </span>
              {album && <span> - </span>}
              {album && (
                <NoDrag
                  className="inline cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all"
                  title={album.name}
                  onClick={async () => {
                    await RendererWindow.display.reactReadyAwait();
                    RendererIPCMessageBus.display.deliver({
                      type: "album",
                      id: album.id
                    });
                  }}>
                  {album.name}
                </NoDrag>
              )}
            </Marquee>
          </div>
          <NoDrag className="flex items-center justify-start gap-1">
            <ControlButton
              label="上一首"
              icon={SkipBack}
              disabled={trackMetaBus.data?.mode === "fm"}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("previous")}
              filled
            />
            <ControlButton
              icon={isPlaying ? Pause : Play}
              label={isPlaying ? "暂停" : "播放"}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("play-toggle")}
              filled
            />
            <ControlButton
              label="下一首"
              icon={SkipForward}
              onClick={() => RendererIPCMessageBus.playerAction.deliver("next")}
              filled
            />
          </NoDrag>
        </div>
        <div className="h-full flex flex-col justify-between items-end">
          <NoDrag>
            <button
              className="
                flex size-5 items-center justify-center rounded-full outline-none
                transition-all duration-200 ease-in-out
                hover:bg-primary-text/50 hover:text-primary
                active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/35
              "
              title="隐藏"
              onClick={close}>
              <X className="size-3.5" />
            </button>
          </NoDrag>
          <div className="font-medium text-[12px] group absolute bottom-0">
            <span>{RendererFormat.duration(progressBus.data?.currentTime, "s")}</span>
            <span className="mx-0.5">/</span>
            <span>{RendererFormat.duration(progressBus.data?.duration, "s")}</span>
          </div>
        </div>
      </section>
    </Drag>
  );
};

export default memo(MiniPlayerPage);

const ControlButton = ({
  onClick,
  label,
  filled,
  disabled,
  icon: Icon
}: {
  label: string;
  filled?: boolean;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: NormalFunc;
}) => {
  return (
    <button
      className={cx(
        `flex size-5 items-center justify-center rounded-full outline-none
        transition-all duration-300 ease-in-out active:scale-90
        hover:bg-(--text-color-on-main)/50 hover:text-primary
        focus-visible:ring-2 focus-visible:ring-primary/35`,
        disabled && "opacity-50"
      )}
      title={label}
      onClick={disabled ? undefined : onClick}>
      <Icon className="size-3.5" fill={filled ? "currentColor" : "none"} />
    </button>
  );
};
