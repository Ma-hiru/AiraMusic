import { Info, Music2, Search, LocateFixed } from "lucide-react";
import { memo, useRef, useMemo, useState, useEffect, useCallback, type ReactNode } from "react";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { openTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { NeteaseTrackRecord, NeteaseNetworkImage } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";
import IconButton from "@/common/components/data-input/icon-button";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppModal, { createTrackInfoModal } from "@/common/components/display/modal";
import TrackList, {
  type TrackListRef,
  type TrackListClickFunc
} from "@/common/components/display/track_list";

import { useQueueSearch } from "./use-queue-search";

export type PlayListQueueProps = {
  active?: boolean;
  activeIndex: number;
  progress?: ReactNode;
  onPlay: TrackListClickFunc;
  tracks: NeteaseTrackRecord[];
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  activeTrack: Nullable<NeteaseTrackRecord>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  status: "idle" | "error" | "paused" | "loading" | "playing";
};

const statusLabels: Record<PlayListQueueProps["status"], string> = {
  idle: "等待播放",
  error: "播放失败",
  paused: "已暂停",
  loading: "加载中",
  playing: "正在播放"
};

const PlayListQueue = ({
  addToPlaylistLast,
  addToPlaylistNext,
  openComment,
  onPlay,
  onClickAlbum,
  onClickArtist,
  status,
  tracks,
  progress,
  activeIndex,
  activeTrack,
  active = true
}: PlayListQueueProps) => {
  const { heartManager, playableManager } = useUserTrackManager();
  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  const [keyword, setKeyword] = useState("");
  const query = keyword.trim();
  const visibleTracks = useQueueSearch(tracks, query, active);
  const [locateRequest, setLocateRequest] = useState(0);
  const lastLocateRequest = useRef(0);
  const activeCover = useMemo(
    () =>
      activeTrack
        ? NeteaseNetworkImage.fromTrackCover(activeTrack.detail)
            .setSize(RendererImageConstants.PlaylistPageTrackCoverSize)
            .setAlt(activeTrack.detail.name)
        : null,
    [activeTrack]
  );

  const currentVisibleIndex = query
    ? visibleTracks.findIndex((track) => track.id === activeTrack?.id)
    : activeIndex;

  useEffect(() => {
    if (!active || currentVisibleIndex < 0) return;
    const manualLocate = lastLocateRequest.current !== locateRequest;
    lastLocateRequest.current = locateRequest;
    const timer = window.setTimeout(
      () => void trackListRef.current?.scrollToItem(currentVisibleIndex),
      manualLocate ? 0 : 500
    );
    return () => window.clearTimeout(timer);
  }, [active, activeIndex, currentVisibleIndex, locateRequest, tracks.length]);

  const locateCurrent = useCallback(() => {
    if (currentVisibleIndex < 0) setKeyword("");
    setLocateRequest((value) => value + 1);
  }, [currentVisibleIndex]);

  const openCurrentTrackInfo = useCallback(() => {
    if (activeTrack) AppModal._create(createTrackInfoModal, { track: activeTrack });
  }, [activeTrack]);

  const onQueuePlay = useCallback<TrackListClickFunc>(
    (track) =>
      onPlay(
        track,
        tracks.findIndex((item) => item.id === track.id)
      ),
    [onPlay, tracks]
  );

  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast,
    addToPlaylistNext,
    onClickAlbum,
    onClickArtist,
    onPlay: onQueuePlay,
    openComment,
    addTrackToPlaylist: openTrackAddToPlaylist
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
        <NeteaseImage
          className="size-10 shrink-0 rounded-md"
          cacheLazy={false}
          image={activeCover}
          cache
        />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 flex items-center gap-1 text-[10px] opacity-70">
            <Music2 className="size-3" />
            {activeTrack ? statusLabels[status] : "暂无播放歌曲"}
          </p>
          <p className="truncate text-[13px] font-semibold">
            {activeTrack?.detail.name ?? "播放列表为空"}
          </p>
          {activeTrack && (
            <p className="mt-0.5 truncate text-[11px] opacity-60">
              {activeTrack.detail.ar.map((artist) => artist.name).join(" / ")}
              {" - "}
              {activeTrack.detail.al.name}
            </p>
          )}
        </div>
        {activeTrack && (
          <div className="flex shrink-0 self-stretch flex-col items-end justify-between gap-1 pl-1">
            <IconButton
              icon={Info}
              label="歌曲信息"
              size="compact"
              variant="plain"
              iconClassName="size-3.5!"
              onClick={openCurrentTrackInfo}
            />
            {progress}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex w-full items-center justify-between gap-3">
          <button
            className="flex items-center gap-1 text-[12px] leading-none opacity-70 transition-opacity hover:opacity-100 disabled:opacity-35 cursor-pointer"
            type="button"
            disabled={activeIndex < 0}
            onClick={locateCurrent}>
            <LocateFixed className="size-3.5" />
            定位当前
          </button>
          <label className="flex h-7 w-44 max-w-[60%] items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2 focus-within:border-primary/60">
            <Search className="size-3 shrink-0 opacity-50" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:opacity-50"
              value={keyword}
              aria-label="搜索队列"
              placeholder="搜索队列"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
        </div>
      </div>
      <TrackList
        ref={trackListRef}
        id={0}
        className="min-h-0 flex-1"
        type="normal"
        paddingBottom={4}
        tracks={visibleTracks}
        activeID={activeTrack?.id}
        heartManager={heartManager}
        playableManager={playableManager}
        emptyTips={query ? "没有匹配的歌曲" : "播放列表为空"}
        trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
        onClick={onQueuePlay}
        onContext={onContextMenu}
        onClickAlbum={onClickAlbum}
        onClickArtist={onClickArtist}
      />
    </div>
  );
};

export default memo(PlayListQueue);
