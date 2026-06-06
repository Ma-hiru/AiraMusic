import { cx } from "@emotion/css";
import { type LucideIcon, Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { type FC, Fragment, memo, useCallback, useMemo } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererEventBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseNetworkImage, NeteaseURL } from "@/common/netease/models";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { RendererFormat } from "@/common/lib/format";

import Drag from "@/common/components/drag/drag";
import NoDrag from "@/common/components/drag/no-drag";
import NeteaseImage from "@/common/components/image/netease-image";
import AcrylicBackground from "@/common/components/public/acrylic-background";

const MiniPlayerPage: FC = () => {
  useThemeInjectFromBus();
  const playerBus = useListenable(RendererEventBus.player);
  const progressBus = useListenable(RendererEventBus.progress);

  const track = playerBus.data?.track?.detail;
  const isPlaying = playerBus.data?.status === "playing";
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
    RendererEventBus.playerAction.send(isPlaying ? "pause" : "play");
  }, [isPlaying]);

  return (
    <Drag className={cx("relative overflow-hidden", !bg && "text-black")}>
      <section className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          className="absolute inset-0"
          blur={10}
          brightness={0.5}
          opacity={0.7}
          src={bg}
        />
      </section>
      <section className="h-screen w-screen grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 z-10">
        <NoDrag className="relative size-11 rounded-md border overflow-hidden border-white/30 bg-(--theme-color-main)/30">
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
                RendererWindow.image.send("imageCheckerBus", {
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
        </NoDrag>
        <div className="grid min-w-0 grid-rows-[1fr_auto] gap-0.5">
          <div className="min-w-0 self-end">
            <h1 className="truncate text-[12px] font-black leading-4">
              {playerBus.data?.track?.name || "暂无播放"}
            </h1>
            <h2 className="truncate text-[9px] font-semibold leading-3  opacity-80">
              {playerBus.data?.track?.detail.ar.map((a, index) => {
                return (
                  <Fragment key={a.id}>
                    <NoDrag
                      onClick={async () => {
                        await RendererWindow.display.reactReadyAwait();
                        RendererEventBus.display.send({
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
                    {index !== (playerBus.data?.track?.detail.ar.length ?? 0) - 1 && (
                      <span> / </span>
                    )}
                  </Fragment>
                );
              })}
            </h2>
          </div>
          <NoDrag className="flex items-center justify-start gap-1">
            <ControlButton
              filled
              icon={SkipBack}
              label="上一首"
              onClick={() => RendererEventBus.playerAction.send("previous")}
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
              onClick={() => RendererEventBus.playerAction.send("next")}
            />
          </NoDrag>
        </div>
        <div className="h-full flex flex-col justify-start items-end">
          <NoDrag>
            <button
              title="隐藏"
              onClick={close}
              className="
                flex size-5 items-center justify-center rounded-full outline-none
                transition-all duration-200 ease-in-out
                hover:bg-(--text-color-on-main)/50 hover:text-(--theme-color-main)
                active:scale-90 focus-visible:ring-2 focus-visible:ring-(--theme-color-main)/35
              ">
              <X className="size-3.5" />
            </button>
          </NoDrag>
          <div className="font-medium text-[12px] absolute bottom-0">
            {RendererFormat.duration(progressBus.data?.currentTime, "s")} /{" "}
            {RendererFormat.duration(progressBus.data?.duration, "s")}
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
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="
        flex size-5 items-center justify-center rounded-full outline-none
        transition-all duration-300 ease-in-out active:scale-90
        hover:bg-(--text-color-on-main)/50 hover:text-(--theme-color-main)
        focus-visible:ring-2 focus-visible:ring-(--theme-color-main)/35
      ">
      <Icon className="size-3.5" fill={filled ? "currentColor" : "none"} />
    </button>
  );
};
