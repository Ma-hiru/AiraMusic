import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useThemeInjectFromBus } from "@mahiru/ui/public/hooks/useThemeInjectFromBus";
import { requestCommentProps, useComments } from "@mahiru/ui/public/hooks/useComments";
import { CommentSort, CommentType } from "@mahiru/ui/public/enum";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

import Control from "./Control";
import Title from "./Title";
import Tabs from "./Tabs";
import Content from "./Content";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";

const CommentsPage: FC<object> = () => {
  const commentBus = useListenableHook(ElectronServices.Bus.comment);
  const [props, setProps] = useState<Nullable<requestCommentProps>>(null);
  const [comments, status] = useComments(props);
  const [sortType, setSortType] = useState(CommentSort.Hot);

  const propsRef = useRef({
    sortType,
    commentBus,
    comments,
    props
  });
  propsRef.current = {
    sortType,
    commentBus,
    comments,
    props
  };
  const reload = useCallback(() => {
    const commentBus = propsRef.current.commentBus;
    const sortType = propsRef.current.sortType;
    let type;
    switch (commentBus.data?.type) {
      case "track":
        type = CommentType.Song;
        break;
      case "album":
        type = CommentType.Album;
        break;
      case "playlist":
        type = CommentType.Playlist;
        break;
    }
    const id = commentBus.data?.id;
    if (id == null || type == null) return;
    setProps({
      id,
      type,
      pageNo: 1,
      pageSize: 20,
      sortType: sortType
    });
  }, []);

  useThemeInjectFromBus();
  useEffect(() => {
    ElectronServices.Bus.updateBus.send("player");
    ElectronServices.Bus.updateBus.send("info");
  }, []);
  useEffect(
    () => reload(),
    [
      // id改变刷新数据
      commentBus.data?.id,
      commentBus.data?.type,
      reload,
      sortType
    ]
  );

  const requestNextPage = useCallback(() => {
    const comments = propsRef.current.comments;
    const props = propsRef.current.props;
    if (props == null || !comments.hasMore || status === "loading") return;
    setProps({
      ...props,
      pageNo: props.pageNo + 1
    });
  }, [status]);

  return (
    <div className="w-screen h-screen pt-10 overflow-hidden gird grid-rows-[auto,1fr]">
      <Control className="h-10 absolute top-0 left-0 right-0 z-10" />
      <AppErrorBoundary canReset toast={false} name="CommentsPage" onReset={reload}>
        <ThrowIf when={status === "error"} message="加载评论失败" />
        <AppLoading loading={status === "loading"}>
          <Title className="h-25" commentBus={commentBus} />
          <Tabs
            className="h-5"
            sortType={sortType}
            setSortType={setSortType}
            totalComment={comments.totalComment}
          />
          <Content
            className="h-[calc(100vh-160px)]"
            hasMore={comments.hasMore}
            comments={comments.data}
            onEnded={requestNextPage}
            loading={status === "loading"}
          />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(CommentsPage);
