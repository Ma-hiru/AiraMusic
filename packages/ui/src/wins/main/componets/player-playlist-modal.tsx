import { useCallback, useEffect, useRef } from "react";
import { ListMusic } from "lucide-react";
import { PlaylistSource } from "@/common/enum";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import AppModal from "@/common/components/modal";
import TrackList, {
  type TrackListClickFunc,
  type TrackListContextMenuFunc,
  type TrackListRef
} from "@/common/components/track_list";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import type { ModalRender } from "@/common/components/modal/modal-provider";
import RendererImageConstants from "@/common/constants/image";
import AppEntry from "@/wins/main/entry";
import AppContextMenu from "@/common/components/menu";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";

export function createPlayerPlaylistModal(): ModalRender {
  return {
    title: "播放列表",
    subTitle: "Queue",
    width: 900,
    height: 640,
    contentClassName: "overflow-hidden! px-4 pb-4",
    content: <PlayerPlaylistModalContent />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const PlayerPlaylistModalContent = () => {
  const player = AppEntry.usePlayer();
  const trackListRef = useRef<Nullable<TrackListRef>>(null);
  const { heartManager, playableManager } = useUserTrackManager();
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();

  const tracks = player.playlist.list();
  const activeIndex = player.playlist.pos();
  const activeTrack = player.current.track;

  useEffect(() => {
    if (activeIndex < 0) return;
    const timer = window.setTimeout(() => {
      void trackListRef.current?.scrollToItem(activeIndex);
    }, 200);
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
      jumpAlbumPage(id);
      AppModal.close();
    },
    [jumpAlbumPage]
  );

  const onClickArtist = useCallback(
    (id: number) => {
      jumpArtistPage(id);
      AppModal.close();
    },
    [jumpArtistPage]
  );

  const { openTrackComment, addTrackToPlaylistLast, addTrackToPlaylistNext } =
    usePlayerActionInList(() => player.playlist.list());

  // 右键菜单
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();
  const onContextMenu = useCallback<TrackListContextMenuFunc>(
    (e, track) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        onClick: (type, track) => {
          switch (type) {
            case "play":
              onTrackPlay(track, /** unused */ 0);
              break;
            case "album":
              onClickAlbum(track.detail.al.id);
              break;
            case "nextPlay":
              addTrackToPlaylistNext(track);
              break;
            case "addPlayList":
              addTrackToPlaylistLast(track);
              break;
            case "comment":
              void openTrackComment(track);
              break;
          }
        }
      });
    },
    [
      addTrackToPlaylistLast,
      addTrackToPlaylistNext,
      create,
      createTrackContextMenu,
      onClickAlbum,
      onTrackPlay,
      openTrackComment
    ]
  );

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
            <p className="truncate text-[13px] font-black">当前队列</p>
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
        type={PlaylistSource.Other}
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
