import { useSetAtom } from "jotai";
import { memo, useRef, type FC, useState, useEffect } from "react";
import { RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { NeteaseHistoryRecord } from "@/common/netease/models";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { typingAtom, scrollActionsAtom } from "@/wins/main/atoms/layout";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import History, { type HistoryRef } from "@/common/components/page/history";

const HistoryPage: FC<object> = () => {
  const historyRef = useRef<Nullable<HistoryRef>>(null);
  const routerActive = useRouterActive(RoutePathMain, "history");
  const { heartManager, playableManager } = useUserTrackManager();

  // 播放曲目
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay, player } =
    usePlayerActionInList(() => historyRef.current?.totalTracks.current ?? []);
  // 监听播放历史变化，历史为原地修改的数组，浅拷贝更新引用
  const [historyList, setHistoryList] = useState<NeteaseHistoryRecord[]>(() => [
    ...player.history.list
  ]);
  useEffect(() => {
    const sync = () => setHistoryList([...player.history.list]);
    sync();
    return player.history.addListener(sync);
  }, [player.history]);
  // 注册滚动和定位回调
  const { canScrollTop, canFastLocate } = useScrollActionsRegister({
    atom: scrollActionsAtom,
    active: useRouterActive(RoutePathMain, "history"),
    getScrollTopFunc: () => historyRef.current?.scrollTop,
    getFastLocateFunc: () => historyRef.current?.fastLocator
  });

  // 跳转歌手和专辑页
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();
  const { onPageAction } = useDisplayAction({ type: "history" });
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  const setIsTyping = useSetAtom(typingAtom);

  return (
    <History
      ref={historyRef}
      className="router-container"
      pageActionType="out"
      historyList={historyList}
      setIsTyping={setIsTyping}
      canScrollTop={canScrollTop}
      heartManager={heartManager}
      routerActive={routerActive}
      canFastLocate={canFastLocate}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      activeTrackID={player.current.track?.id}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      onPlay={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
    />
  );
};

export default memo(HistoryPage);
