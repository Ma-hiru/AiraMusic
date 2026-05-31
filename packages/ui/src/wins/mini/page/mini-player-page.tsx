import { clamp } from "lodash-es";
import { Pause, Play, SkipBack, SkipForward, X, Music2, type LucideIcon } from "lucide-react";
import { type FC, memo, useCallback, useMemo } from "react";
import Drag from "@/common/components/drag/drag";
import NoDrag from "@/common/components/drag/no-drag";
import NeteaseImage from "@/common/components/image/netease-image";
import { NeteaseImageSize } from "@/common/enum";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererEventBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseNetworkImage } from "@/common/netease/models";

interface ControlButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: NormalFunc;
}

const ControlButton: FC<ControlButtonProps> = ({ icon: Icon, label, active, onClick }) => {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="
        flex size-5 items-center justify-center rounded-full text-black/75 outline-none
        transition-all duration-200 ease-in-out hover:bg-black/8 hover:text-black
        active:scale-90 focus-visible:ring-2 focus-visible:ring-(--theme-color-main)/35
      ">
      <Icon className="size-3.5" fill={active ? "currentColor" : "none"} />
    </button>
  );
};

const MemoControlButton = memo(ControlButton);

const MiniPlayerPage: FC = () => {
  const mainWindow = useListenable(RendererWindow.main);
  const currentWindow = useListenable(RendererWindow.current);
  const playerBus = useListenable(RendererEventBus.player);
  const progressBus = useListenable(RendererEventBus.progress);
  const track = playerBus.data?.track?.detail;
  const isPlaying = playerBus.data?.status === "playing";
  const artist = track?.ar.map((item) => item.name).join(" / ");
  const percent = useMemo(() => {
    const duration = progressBus.data?.duration || (track?.dt ?? 0) / 1000 || 1;
    return clamp(((progressBus.data?.currentTime || 0) / duration) * 100, 0, 100);
  }, [progressBus.data?.currentTime, progressBus.data?.duration, track?.dt]);
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromTrackCover(track)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(track?.name || track?.al.name),
    [track]
  );

  const close = useCallback(() => {
    currentWindow.hide();
    mainWindow.show();
    mainWindow.focus();
  }, [currentWindow, mainWindow]);

  const togglePlay = useCallback(() => {
    RendererEventBus.playerAction.send(isPlaying ? "pause" : "play");
  }, [isPlaying]);

  return (
    <Drag
      className="
        grid h-screen w-screen grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2
        overflow-hidden rounded-lg border border-black/8 bg-white/96 px-2 py-1 text-black
        shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl
      ">
      <div className="relative size-11 overflow-hidden rounded-md border border-black/8 bg-black/5">
        {image ? (
          <NeteaseImage
            cache
            cacheLazy={false}
            image={image}
            shadow="none"
            className="size-full"
            imageClassName="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-black/35">
            <Music2 className="size-5" />
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/12">
          <span
            className="block h-full bg-(--theme-color-main) transition-[width] duration-300 ease-in-out"
            style={{ width: `${percent}%` }}
          />
        </span>
      </div>
      <div className="grid min-w-0 grid-rows-[1fr_auto] gap-0.5">
        <div className="min-w-0 self-end">
          <p className="truncate text-[12px] font-black leading-4">{track?.name || "暂无播放"}</p>
          <p className="truncate text-[9px] font-semibold leading-3 text-black/45">
            {artist || track?.al.name || "AiraMusic"}
          </p>
        </div>
        <NoDrag className="flex items-center justify-start gap-1">
          <MemoControlButton
            icon={SkipBack}
            label="上一首"
            onClick={() => RendererEventBus.playerAction.send("previous")}
          />
          <MemoControlButton
            icon={isPlaying ? Pause : Play}
            label={isPlaying ? "暂停" : "播放"}
            active={isPlaying}
            onClick={togglePlay}
          />
          <MemoControlButton
            icon={SkipForward}
            label="下一首"
            onClick={() => RendererEventBus.playerAction.send("next")}
          />
        </NoDrag>
      </div>
      <NoDrag className="self-start">
        <button
          type="button"
          title="隐藏迷你播放器"
          aria-label="隐藏迷你播放器"
          onClick={close}
          className="
            flex size-5 items-center justify-center rounded-full text-black/45 outline-none
            transition-all duration-200 ease-in-out hover:bg-black/8 hover:text-black
            active:scale-90 focus-visible:ring-2 focus-visible:ring-(--theme-color-main)/35
          ">
          <X className="size-3.5" />
        </button>
      </NoDrag>
    </Drag>
  );
};

export default memo(MiniPlayerPage);
