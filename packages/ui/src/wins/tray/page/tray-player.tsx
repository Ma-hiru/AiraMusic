import { clamp } from "lodash-es";
import { type FC, memo, useMemo } from "react";
import { Disc3, Music2 } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/image/netease-image";

interface TrayPlayerProps {
  track: Optional<NeteaseTrackModel>;
  status: Optional<"playing" | "paused" | "error" | "idle" | "loading">;
  currentTime: Optional<number>;
  duration: Optional<number>;
}

const TrayPlayer: FC<TrayPlayerProps> = ({ track, status, currentTime, duration }) => {
  const artist = track?.ar.map((item) => item.name).join(" / ");
  const percent = useMemo(() => {
    const safeDuration = duration || (track?.dt ?? 0) / 1000 || 1;
    return clamp(((currentTime || 0) / safeDuration) * 100, 0, 100);
  }, [currentTime, duration, track?.dt]);
  const cover = useMemo(
    () =>
      NeteaseNetworkImage.fromTrackCover(track)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(track?.al.name || track?.name),
    [track]
  );

  return (
    <section
      className="
        grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg
        border border-black/6 bg-white px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)]
      ">
      <div className="relative size-11 overflow-hidden rounded-md bg-black/5">
        {cover ? (
          <NeteaseImage
            cache
            cacheLazy={false}
            image={cover}
            shadow="none"
            className="size-full"
            imageClassName="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-black/35">
            <Music2 className="size-5" />
          </div>
        )}
        {status === "playing" && (
          <span className="absolute right-1 top-1 flex size-3 items-center justify-center rounded-full bg-(--theme-color-main)">
            <Disc3 className="size-2 animate-spin text-(--text-color-on-main)" />
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black leading-4 text-black">
            {track?.name || "暂无播放"}
          </p>
          <p className="truncate text-[10px] font-semibold leading-3 text-black/45">
            {artist || track?.al.name || "AiraMusic"}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="h-1 overflow-hidden rounded-full bg-black/8">
            <span
              className="block h-full rounded-full bg-(--theme-color-main) transition-[width] duration-300 ease-in-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[9px] font-semibold text-black/40">
            {RendererFormat.duration(currentTime, "s")}
          </span>
        </div>
      </div>
    </section>
  );
};

export default memo(TrayPlayer);
