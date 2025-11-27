import { FC, memo, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import { useImmer } from "use-immer";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { Store } from "@mahiru/ui/store";

const MiniPlayerPage: FC<object> = () => {
  const [info, setInfo] = useState<Nullable<LyricInit["info"]>>(null);
  const [lyricSync, setLyricSync] = useImmer<LyricSync>({
    currentTime: 0,
    duration: 0,
    lyricVersion: "raw",
    isPlaying: false
  });

  const update = useUpdate();
  useEffect(() => {
    addMessageHandler((message) => {
      const { data, type, to, from } = message;
      if (from === "main" && to === "miniplayer") {
        if (type === "lyricInit") {
          const lyricInit = data as LyricInit;
          setInfo(lyricInit.info);
          update();
        } else if (type === "lyricSync") {
          const lyricSync = data as LyricSync;
          setLyricSync((draft) => {
            draft.currentTime = lyricSync.currentTime;
            draft.duration = lyricSync.duration;
            draft.lyricVersion = lyricSync.lyricVersion;
            draft.isPlaying = lyricSync.isPlaying;
          });
          update();
        }
      }
    }, "mini-player-sync-handler");
    return () => {
      removeMessageHandler("mini-player-sync-handler");
    };
  }, [setLyricSync, update]);
  useEffect(() => {
    window.node.event.loaded({
      win: "miniplayer",
      broadcast: true,
      showAfterLoaded: true
    });
  }, []);
  const cacheID = useRef("");
  const cachedCover = useFileCache(NeteaseImageSizeFilter(info?.cover, ImageSize.xs), {
    onCacheHit: (_, id) => {
      cacheID.current = id;
    }
  });
  const onImageErr = useCallback(
    (e: SyntheticEvent<HTMLImageElement, Event>) => {
      const raw = NeteaseImageSizeFilter(info?.cover, ImageSize.xs) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      console.log(
        `MiniPlayer Image load error: ${cachedCover}, fallback to original cover: ${raw}`
      );
      if (cacheID.current) void Store.remove(cacheID.current);
      cacheID.current = "";
    },
    [cachedCover, info?.cover]
  );
  const percent = lyricSync.duration
    ? Math.min(((lyricSync.currentTime || 0) / lyricSync.duration) * 100, 100)
    : 0;
  return (
    <Drag className="w-full h-full relative bg-white/80 rounded-md text-black overflow-hidden grid grid-rows-1 grid-cols-[auto_1fr] px-2 py-1 items-center select-none backdrop-blur-lg">
      <div className="h-12 w-12 rounded-md overflow-hidden">
        <img
          className="w-full h-full object-cover"
          src={cachedCover || undefined}
          alt={info?.title}
          onError={onImageErr}
        />
      </div>
      <div className="h-full w-full flex flex-col justify-center px-2 gap-[6px] overflow-hidden">
        <div className="flex items-center justify-center gap-1">
          <span className="text-[12px] font-bold truncate">{info?.title}</span>
          <span className="text-[12px]"> - </span>
          <span className="text-[10px] font-medium truncate opacity-50">
            {info?.artist.map((a) => a.name).join("/")}
          </span>
        </div>
        <div className="grid grid-rows-1 grid-cols-[1fr_auto] items-center justify-center gap-1">
          <div className="h-[5px] bg-black/20 rounded-full overflow-hidden">
            <span
              className="h-full block bg-white ease-in-out duration-300 transition-all"
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
          {lyricSync?.isPlaying ? (
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
          onClick={() => {
            window.node.event.close("miniplayer");
            window.node.event.visible("main");
          }}
        />
      </NoDrag>
    </Drag>
  );
};
export default memo(MiniPlayerPage);

function lastTrack() {
  window.node.event.sendMessageTo({
    from: "miniplayer",
    to: "main",
    type: "lastTrack",
    data: undefined
  });
}
function nextTrack() {
  window.node.event.sendMessageTo({
    from: "miniplayer",
    to: "main",
    type: "nextTrack",
    data: undefined
  });
}
function playTrack() {
  window.node.event.sendMessageTo({
    from: "miniplayer",
    to: "main",
    type: "playTrack",
    data: undefined
  });
}
