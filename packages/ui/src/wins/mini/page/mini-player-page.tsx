import { cx } from "@emotion/css";
import {
  Disc3,
  type LucideIcon,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X
} from "lucide-react";
import { type FC, Fragment, memo, useCallback, useEffect, useMemo } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseNetworkImage, NeteaseURL } from "@/common/netease/models";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { RendererFormat } from "@/common/lib/format";

import Drag from "@/common/components/layout/drag/drag";
import NoDrag from "@/common/components/layout/drag/no-drag";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import Marquee from "@/common/components/display/marquee";

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

  const togglePlay = useCallback(() => {
    RendererIPCMessageBus.playerAction.deliver(isPlaying ? "pause" : "play");
  }, [isPlaying]);

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
          blur={10}
          brightness={0.6}
          opacity={1}
          src={bg}
          saturate={2}
          themeColors={themeBus.data?.theme.themeColors}
        />
      </section>
      <section className="h-screen w-screen grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 z-10">
        <NoDrag className="relative size-11 rounded-md border overflow-hidden border-white/30 bg-primary/30">
          {cover ? (
            <NeteaseImage
              cache
              cacheLazy={false}
              image={cover}
              shadow="none"
              className="
                size-full hover:opacity-50 cursor-pointer
                ease-in-out duration-300 transition-opacity
              "
              onClick={async () => {
                if (!cover) return;
                const image = cover.toNetworkImage().setSize(NeteaseImageSize.raw);
                await RendererWindow.image.reactReadyAwait();
                RendererIPCMessageBus.preview.deliver({
                  url: image.src,
                  alt: image.alt
                });
              }}
              imageClassName="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music2 className="size-5" />
            </div>
          )}
          <span className="absolute right-0.5 top-0.5 flex size-2.5 items-center justify-center rounded-full bg-primary">
            <Disc3
              className={cx(
                "size-2 text-(--text-color-on-main)",
                trackMetaBus.data?.status === "playing" && "animate-spin"
              )}
            />
          </span>
        </NoDrag>
        <div className="grid min-w-0 grid-rows-[1fr_auto] gap-0.5">
          <div className="min-w-0 self-end">
            <Marquee
              text={trackMetaBus.data?.track?.name || "暂无播放"}
              className="text-[12px] font-semibold leading-4"
              options={marqueeOpts}
            />
            <Marquee
              className="text-[9px] font-semibold leading-3 opacity-80"
              options={marqueeOpts}>
              <span>
                {trackMetaBus.data?.track?.detail.ar.map((a, index) => {
                  return (
                    <Fragment key={a.id}>
                      <NoDrag
                        onClick={async () => {
                          await RendererWindow.display.reactReadyAwait();
                          RendererIPCMessageBus.display.deliver({
                            type: "artist",
                            id: a.id
                          });
                        }}
                        title={a.name}
                        className="
                            inline cursor-pointer hover:opacity-50
                            ease-in-out duration-300 transition-all
                          ">
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
                  onClick={async () => {
                    await RendererWindow.display.reactReadyAwait();
                    RendererIPCMessageBus.display.deliver({
                      type: "album",
                      id: album.id
                    });
                  }}
                  title={album.name}
                  className="inline cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all">
                  {album.name}
                </NoDrag>
              )}
            </Marquee>
          </div>
          <NoDrag className="flex items-center justify-start gap-1">
            <ControlButton
              filled
              icon={SkipBack}
              label="上一首"
              onClick={() => RendererIPCMessageBus.playerAction.deliver("previous")}
            />
            <ControlButton
              filled
              icon={isPlaying ? Pause : Play}
              label={isPlaying ? "暂停" : "播放"}
              onClick={togglePlay}
            />
            <ControlButton
              filled
              icon={SkipForward}
              label="下一首"
              onClick={() => RendererIPCMessageBus.playerAction.deliver("next")}
            />
          </NoDrag>
        </div>
        <div className="h-full flex flex-col justify-between items-end">
          <NoDrag>
            <button
              title="隐藏"
              onClick={close}
              className="
                flex size-5 items-center justify-center rounded-full outline-none
                transition-all duration-200 ease-in-out
                hover:bg-(--text-color-on-main)/50 hover:text-primary
                active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/35
              ">
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
  icon: Icon,
  label,
  filled,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  filled?: boolean;
  onClick: NormalFunc;
}) => {
  return (
    <button
      title={label}
      onClick={onClick}
      className="
        flex size-5 items-center justify-center rounded-full outline-none
        transition-all duration-300 ease-in-out active:scale-90
        hover:bg-(--text-color-on-main)/50 hover:text-primary
        focus-visible:ring-2 focus-visible:ring-primary/35
      ">
      <Icon className="size-3.5" fill={filled ? "currentColor" : "none"} />
    </button>
  );
};
