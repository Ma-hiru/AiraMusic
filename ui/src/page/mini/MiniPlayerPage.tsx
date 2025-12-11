import { FC, memo, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { CacheStore } from "@mahiru/ui/store";

const MiniPlayerPage: FC<object> = () => {
  const [lyricInit, setLyricInit] = useState<LyricInit>();
  const [lyricSync, setLyricSync] = useState<LyricSync>();
  const cacheID = useRef("");
  const track = lyricInit?.trackStatus.track;
  const percent = lyricSync?.progress.duration
    ? Math.min(((lyricSync.progress.currentTime || 0) / lyricSync.progress.duration) * 100, 100)
    : 0;

  const cachedCover = useFileCache(
    Filter.NeteaseImageSize(track?.al.cachedPicUrl || track?.al.picUrl, ImageSize.xs),
    {
      onCacheHit: (_, id) => {
        cacheID.current = id;
      }
    }
  );
  const onImageErr = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.xs) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      if (cacheID.current) void CacheStore.remove(cacheID.current);
      cacheID.current = "";
    },
    [track?.al.picUrl]
  );

  useEffect(() => {
    const removeInitListener = Renderer.addMessageHandler("lyricSync", "main", setLyricSync);
    const removeSyncListener = Renderer.addMessageHandler("lyricInit", "main", setLyricInit);
    return () => {
      removeInitListener();
      removeSyncListener();
    };
  }, []);
  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
  }, []);
  return (
    <Drag className="w-screen h-screen overflow-hidden relative bg-white rounded-md text-black grid grid-rows-1 grid-cols-[auto_1fr] px-2 py-1 items-center select-none backdrop-blur-lg">
      <div className="h-12 w-12 rounded-md overflow-hidden">
        <img
          className="w-full h-full object-cover"
          src={cachedCover || undefined}
          loading="lazy"
          decoding="async"
          alt={track?.name}
          onError={onImageErr}
        />
      </div>
      <div className="h-full w-full flex flex-col justify-center px-2 gap-[6px] overflow-hidden">
        <div className="flex items-center justify-center gap-1">
          <span className="text-[12px] font-bold truncate">{track?.name}</span>
          <span className="text-[12px]"> - </span>
          <span className="text-[10px] font-medium truncate opacity-50">
            {track?.ar.map((a) => a.name).join("/")}
          </span>
        </div>
        <div className="grid grid-rows-1 grid-cols-[1fr_auto] items-center justify-center gap-1">
          <div className="h-[5px] bg-gray-500 rounded-full overflow-hidden">
            <span
              className="h-full block bg-white/80 ease-in-out duration-300 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <NoDrag className="flex items-center gap-2 justify-center">
          <SkipBack
            className="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
            onClick={lastTrack}
            fill={"#171b20"}
          />
          {lyricSync?.playerStatus.playing ? (
            <Pause
              className="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
              onClick={playTrack}
              fill={"#171b20"}
            />
          ) : (
            <Play
              className="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
              onClick={playTrack}
              fill={"#171b20"}
            />
          )}
          <SkipForward
            className="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
            onClick={nextTrack}
            fill={"#171b20"}
          />
        </NoDrag>
      </div>
      <NoDrag className="absolute right-1 top-1">
        <X
          className="size-4 hover:opacity-50 cursor-pointer active:text-white/80"
          onClick={() => Renderer.event.close({ broadcast: true })}
        />
      </NoDrag>
    </Drag>
  );
};
export default memo(MiniPlayerPage);

function lastTrack() {
  Renderer.sendMessage("lyricSyncReverse", "main", {
    playerControl: "last"
  });
}

function nextTrack() {
  Renderer.sendMessage("lyricSyncReverse", "main", {
    playerControl: "next"
  });
}

function playTrack() {
  Renderer.sendMessage("lyricSyncReverse", "main", {
    playerControl: "play"
  });
}
