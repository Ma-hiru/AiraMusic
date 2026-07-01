import { useCallback, useEffect, useRef } from "react";
import { ListMusic } from "lucide-react";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { openTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useListenable } from "@/common/hooks/use-listenable";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";
import type RendererPlayer from "@/common/player/core";
import AppModal from "@/common/components/display/modal";
import RendererImageConstants from "@/common/constants/image";

import TrackList, {
  type TrackListClickFunc,
  type TrackListRef
} from "@/common/components/display/track_list";
import { NeteaseTrackRecord } from "@/common/netease/models";

type PlaylistModalProps = {
  onJumpPage?: NormalFunc;
  jumpAlbumPage: NormalFunc<[id: number]>;
  jumpArtistPage: NormalFunc<[id: number]>;
  openTrackComment: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
};

export function createPlayerPlaylistModal({
  player,
  ...rest
}: PlaylistModalProps & { player: RendererPlayer }): ModalRender {
  return {
    title: "播放列表",
    subTitle: "Queue",
    width: 900,
    height: 640,
    contentClassName: "overflow-hidden! px-4 pb-4",
    content: <PlayerPlaylistModalContent {...rest} rendererPlayer={player} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const PlayerPlaylistModalContent = ({
  onJumpPage,
  rendererPlayer,
  jumpArtistPage,
  jumpAlbumPage,
  openTrackComment,
  addTrackToPlaylistLast,
  addTrackToPlaylistNext
}: PlaylistModalProps & { rendererPlayer: RendererPlayer }) => {
  const { heartManager, playableManager } = useUserTrackManager();
  const player = useListenable(rendererPlayer);
  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  const tracks = player.playlist.list();
  const activeIndex = player.playlist.pos();
  const activeTrack = player.current.track;

  useEffect(() => {
    if (activeIndex < 0) return;
    const timer = window.setTimeout(() => {
      void trackListRef.current?.scrollToItem(activeIndex);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeIndex, tracks.length]);

  const onTrackPlay = useCallback<TrackListClickFunc>(
    (track) => {
      player.playlist.jump(track);
    },
    [player.playlist]
  );

  const onClickAlbum = useCallback(
    (id: number) => {
      void jumpAlbumPage(id);
      AppModal.close();
      onJumpPage?.();
    },
    [jumpAlbumPage, onJumpPage]
  );

  const onClickArtist = useCallback(
    (id: number) => {
      void jumpArtistPage(id);
      AppModal.close();
      onJumpPage?.();
    },
    [jumpArtistPage, onJumpPage]
  );

  // 右键菜单
  const { onContextMenu } = useTrackContextMenu({
    addToPlaylistLast: addTrackToPlaylistLast,
    addToPlaylistNext: addTrackToPlaylistNext,
    onClickAlbum,
    onPlay: onTrackPlay,
    openComment: openTrackComment,
    addTrackToPlaylist: openTrackAddToPlaylist
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header
        className="
          flex shrink-0 items-center justify-between gap-3 rounded-lg
          border border-white/10 bg-white/10 px-3 py-2
          shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
        ">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md">
            <ListMusic className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">当前队列</p>
            <p className="truncate text-[11px] font-semibold opacity-60">
              {tracks.length} 首{activeTrack ? ` / 正在播放 ${activeTrack.detail.name}` : ""}
            </p>
          </div>
        </div>
      </header>
      <TrackList
        className="
          min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10
          bg-black/5 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
        "
        ref={trackListRef}
        id={0}
        tracks={tracks}
        type="normal"
        activeID={activeTrack?.id}
        onClick={onTrackPlay}
        onContext={onContextMenu}
        onClickAlbum={onClickAlbum}
        onClickArtist={onClickArtist}
        heartManager={heartManager}
        playableManager={playableManager}
        trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
        paddingBottom={8}
        emptyTips="播放列表为空"
      />
    </div>
  );
};
