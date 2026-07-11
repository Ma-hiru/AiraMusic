import { memo, useRef, type FC, useState, useEffect } from "react";
import { RendererCache } from "@/common/lib/cache";
import { CommentSort, CommentType } from "@/common/enum";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useComments } from "@/common/hooks/use-comments";
import { useListenable } from "@/common/hooks/use-listenable";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AppToast from "@/common/components/display/toast";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import AcrylicBackground from "@/common/components/display/acrylic-background";

import Tabs from "./tabs";
import Title from "./title";
import Content from "./content";
import Control from "./control";

const CommentsPage: FC<object> = () => {
  const commentBus = useListenable(RendererIPCMessageBus.comment);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const themeBus = useThemeInjectFromBus();
  const [dynamicContent, setDynamicContent] = useState(() => {
    return RendererCache.browser.getOne("comments-dynamic-content") === "true";
  });
  const [id, setId] = useState(0);
  const [type, setType] = useState(CommentType.Song);
  const [sortType, setSortType] = useState(CommentSort.Hot);
  const { status, comments, loadMore } = useComments({ id, type, sortType });

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
    RendererIPCMessageBus.updater.deliver("track-meta");
  }, [dynamicContent]);

  const lastTrackID = useRef(trackMetaBus.data?.track?.id);
  useEffect(() => {
    const track = trackMetaBus.data?.track;
    const playing = trackMetaBus.data?.status === "playing";
    if (!track) return;
    if (dynamicContent) {
      RendererCache.browser.setOne("comments-dynamic-content", "true");
      if (lastTrackID.current !== track.id && playing) {
        RendererIPCMessageBus.comment.dispatch({
          id: track.id,
          type: "track"
        });
        lastTrackID.current = track.id;
      }
    } else {
      RendererCache.browser.setOne("comments-dynamic-content", "false");
    }
  }, [dynamicContent, trackMetaBus.data?.status, trackMetaBus.data?.track]);

  return (
    <div className="w-screen h-screen pt-10 overflow-hidden flex flex-col relative">
      <Control className="h-10 absolute top-0 left-0 right-0 z-10" />
      <div className="fixed inset-0 z-[-1]">
        <AcrylicBackground
          blur={60}
          opacity={1}
          saturate={2.5}
          brightness={0.4}
          src={themeBus.data?.backgroundCover}
          themeColors={themeBus.data?.theme.themeColors}
          fluid
          fluidPaused
        />
      </div>
      <AppError message="加载评论失败" reset={loadMore} when={status === "error"}>
        <AppLoading loading={comments.data.length === 0 && status !== "success"}>
          <Title className="shrink-0" commentBus={commentBus} />
          <Tabs
            className="h-5"
            sortType={sortType}
            setSortType={setSortType}
            dynamicContent={dynamicContent}
            totalComment={comments.totalComment}
            setDynamicContent={setDynamicContent}
          />
          <Content
            className="flex-1"
            comments={comments.data}
            hasMore={comments.hasMore}
            type={commentBus.data?.type}
            loading={status === "loading"}
            sourceID={commentBus.data?.id}
            onEnded={loadMore}
          />
        </AppLoading>
      </AppError>
      <AppToast.Provider className="top-10" />
    </div>
  );
};

export default memo(CommentsPage);
