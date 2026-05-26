import { type FC, memo, useEffect, useState } from "react";
import { useComments } from "@/common/hooks/use-comments";
import { CommentSort, CommentType } from "@/common/enum";
import { CacheStore } from "@/common/store/cache";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AppToast from "@/common/components/toast";

import Control from "./control";
import Title from "./title";
import Tabs from "./tabs";
import Content from "./content";
import AppLoading from "@/common/components/fallback/app-loading";
import AcrylicBackground from "@/common/components/public/acrylic-background";
import { RendererEventBus } from "@/common/lib/bus";
import AppError from "@/common/components/fallback/app-error";

const CommentsPage: FC<object> = () => {
  const commentBus = useListenable(RendererEventBus.comment);
  const playerBus = useListenable(RendererEventBus.player);
  const [dynamicContent, setDynamicContent] = useState(() => {
    return CacheStore.browser.getOne("comments-dynamic-content") === "true";
  });
  const [id, setId] = useState(0);
  const [type, setType] = useState(CommentType.Song);
  const [sortType, setSortType] = useState(CommentSort.Hot);
  const { comments, status, loadMore } = useComments({ id, type, sortType });

  useThemeInjectFromBus();

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
    RendererEventBus.mainBusUpdater.send("player");
    RendererEventBus.mainBusUpdater.send("info");
  }, [dynamicContent]);

  const InfoBus = useListenable(RendererEventBus.info);

  useEffect(() => {
    const track = playerBus.data?.track;
    if (!track) return;
    if (dynamicContent) {
      CacheStore.browser.setOne("comments-dynamic-content", "true");
      RendererEventBus.comment.commit({
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
        <AcrylicBackground src={InfoBus.data?.backgroundCover} />
      </div>
      <AppError reset={loadMore} when={status === "error"} message="加载评论失败">
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
      </AppError>
      <AppToast.Provider className="top-10" />
    </div>
  );
};

export default memo(CommentsPage);
