import { useCallback, type ReactNode } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { useListenable } from "@/common/hooks/use-listenable";
import IconButton from "@/common/components/data-input/icon-button";
import PlayListQueue, { type PlayListQueueProps } from "@/common/components/page/play-list/queue";
import type RendererPlayer from "@/common/player/core";
import type { NeteaseTrackRecord } from "@/common/netease/models";

import AppDrawer from "./use";
import type { DrawerRender } from "./drawer-provider";
import CurrentTrackProgress from "./current-track-progress";

type PlaylistDrawerCallbackProps = {
  onJumpPage?: NormalFunc;
  jumpAlbumPage: NormalFunc<[id: number]>;
  jumpArtistPage: NormalFunc<[id: number]>;
  openTrackComment: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
};

type DrawerActionProps = {
  onPageAction?: NormalFunc;
};

export type PlaylistDrawerProps = DrawerActionProps &
  PlaylistDrawerCallbackProps & {
    player: RendererPlayer;
  };

export type PlayListDrawerProps = DrawerActionProps & { content: ReactNode };

export function createPlayListDrawer({ onPageAction, content }: PlayListDrawerProps): DrawerRender {
  return {
    toggleKey: "play-list",
    title: "播放列表",
    width: 420,
    resizable: { minWidth: 360, maxWidth: 640 },
    contentClassName: "overflow-hidden! px-4 pb-4",
    headerActions: onPageAction ? (
      <IconButton
        label="展开播放列表"
        variant="plain"
        iconClassName="size-4!"
        icon={SquareArrowOutUpRight}
        onClick={() => {
          AppDrawer.close();
          onPageAction();
        }}
      />
    ) : undefined,
    content
  };
}

export function createPlayerPlaylistDrawer({
  onPageAction,
  player,
  ...rest
}: PlaylistDrawerProps): DrawerRender {
  return createPlayListDrawer({
    onPageAction,
    content: <PlayerPlaylistDrawerContent {...rest} rendererPlayer={player} />
  });
}

// eslint-disable-next-line react-refresh/only-export-components
const PlayerPlaylistDrawerContent = ({
  addTrackToPlaylistLast,
  addTrackToPlaylistNext,
  openTrackComment,
  onJumpPage,
  jumpAlbumPage,
  jumpArtistPage,
  rendererPlayer
}: PlaylistDrawerCallbackProps & { rendererPlayer: RendererPlayer }) => {
  const player = useListenable(rendererPlayer);
  const activeTrack = player.current.track;
  const onPlay = useCallback<PlayListQueueProps["onPlay"]>(
    (track) => player.playlist.jump(track),
    [player.playlist]
  );
  const onClickAlbum = useCallback(
    (id: number) => {
      void jumpAlbumPage(id);
      AppDrawer.close();
      onJumpPage?.();
    },
    [jumpAlbumPage, onJumpPage]
  );
  const onClickArtist = useCallback(
    (id: number) => {
      void jumpArtistPage(id);
      AppDrawer.close();
      onJumpPage?.();
    },
    [jumpArtistPage, onJumpPage]
  );

  return (
    <PlayListQueue
      activeTrack={activeTrack}
      openComment={openTrackComment}
      tracks={player.playlist.list()}
      activeIndex={player.playlist.pos()}
      status={player.statusText ?? "idle"}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      progress={activeTrack ? <CurrentTrackProgress audio={player.audio} /> : undefined}
      onPlay={onPlay}
      onClickAlbum={onClickAlbum}
      onClickArtist={onClickArtist}
    />
  );
};
