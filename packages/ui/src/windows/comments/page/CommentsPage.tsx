import { FC, memo, useEffect, useMemo, useState } from "react";
import { useComments } from "@mahiru/ui/public/hooks/useComments";
import { CommentSort, CommentType, NeteaseImageSize } from "@mahiru/ui/public/enum";
import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

import Control from "./Control";
import Title from "./Title";
import Tabs from "./Tabs";
import Content from "./Content";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";

const CommentsPage: FC<object> = () => {
  const commentBus = useListenable(ElectronServices.Bus.comment);
  const playerBus = useListenable(ElectronServices.Bus.player);
  const [dynamicContent, setDynamicContent] = useState(() => {
    return CacheStore.browser.getOne("comments-dynamic-content") === "true";
  });
  const [id, setId] = useState(0);
  const [type, setType] = useState(CommentType.Song);
  const [sortType, setSortType] = useState(CommentSort.Hot);
  const { comments, status, loadMore } = useComments({ id, type, sortType });

  useEffect(() => {
    if (!commentBus.data) return;
    setId(commentBus.data.id);
    switch (commentBus.data.type) {
      case "album":
        setType(CommentType.Album);
        break;
      case "playlist":
        setType(CommentType.Playlist);
        break;
      case "track":
        setType(CommentType.Song);
        break;
    }
  }, [commentBus.data]);

  useEffect(() => {
    ElectronServices.Bus.mainBusUpdater.send("player");
    ElectronServices.Bus.mainBusUpdater.send("info");
  }, [dynamicContent]);

  const background = useMemo(() => {
    const src = playerBus.data?.track?.detail.al.picUrl;
    if (!src) return undefined;
    return NeteaseNetworkImage.fromURL(src).setSize(NeteaseImageSize.sm).src;
  }, [playerBus.data?.track?.detail.al.picUrl]);

  useEffect(() => {
    const track = playerBus.data?.track;
    if (!track) return;
    if (dynamicContent) {
      CacheStore.browser.setOne("comments-dynamic-content", "true");
      ElectronServices.Bus.comment.commit({
        id: track.id,
        type: "track"
      });
    } else {
      CacheStore.browser.setOne("comments-dynamic-content", "false");
    }
  }, [dynamicContent, playerBus.data?.track]);

  return (
    <div className="w-screen h-screen pt-10 overflow-hidden gird grid-rows-[auto,1fr] relative">
      <Control className="h-10 absolute top-0 left-0 right-0 z-10" />
      <div className="fixed inset-0 z-[-1]">
        <AcrylicBackground src={background} />
      </div>
      <AppErrorBoundary canReset toast={false} name="CommentsPage" onReset={loadMore}>
        <ThrowIf when={status === "error"} message="加载评论失败" />
        <AppLoading loading={comments.data.length === 0 && status !== "success"}>
          <Title className="h-25" commentBus={commentBus} />
          <Tabs
            className="h-5"
            sortType={sortType}
            setSortType={setSortType}
            totalComment={comments.totalComment}
            dynamicContent={dynamicContent}
            setDynamicContent={setDynamicContent}
          />
          <Content
            className="h-[calc(100vh-160px)]"
            hasMore={comments.hasMore}
            comments={comments.data}
            onEnded={loadMore}
            loading={status === "loading"}
            type={commentBus.data?.type}
            sourceID={commentBus.data?.id}
          />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(CommentsPage);
