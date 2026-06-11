import { type FC, memo, useEffect, useRef, useState } from "react";
import { NeteaseHistoryRecord } from "@/common/netease/models";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useLocateOrScrollTopRegister } from "@/wins/main/hooks/use-locate-or-scroll-top-register";
import { useSetAtom } from "jotai";
import { typingAtom } from "@/wins/main/atoms/layout";

import History, { type HistoryRef } from "@/common/components/page/history";

const HistoryPage: FC<object> = () => {
  const historyRef = useRef<Nullable<HistoryRef>>(null);
  const { heartManager, playableManager } = useUserTrackManager();

  // 播放曲目
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, onTrackPlay, openTrackComment, player } =
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
  const { canFastLocate, canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => historyRef.current?.scrollTop,
    getFastLocateFunc: () => historyRef.current?.fastLocator,
    page: "history"
  });
  // 跳转歌手和专辑页
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();
  const { onPageAction } = useDisplayAction({ type: "history" });

  const setIsTyping = useSetAtom(typingAtom);

  return (
    <History
      ref={historyRef}
      className="router-container"
      historyList={historyList}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      onPlay={onTrackPlay}
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={player.current.track?.id}
      canFastLocate={canFastLocate}
      canScrollTop={canScrollTop}
      pageActionType="out"
      onPageAction={onPageAction}
      setIsTyping={setIsTyping}
    />
  );
};

export default memo(HistoryPage);
