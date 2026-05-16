import { cx } from "@emotion/css";
import { FC, memo, useCallback, useRef } from "react";

import Item from "./Item";
import InfiniteList from "@mahiru/ui/common/components/infinite/InfiniteList";

interface ContentProps {
  comments: NeteaseAPI.NeteaseComment[];
  onEnded: NormalFunc | PromiseFunc;
  hasMore: boolean;
  loading: boolean;
  sourceID?: number;
  type?: "album" | "playlist" | "track";
  className?: string;
}

const Content: FC<ContentProps> = ({
  className,
  comments,
  onEnded,
  hasMore,
  loading,
  sourceID,
  type
}) => {
  const buildKey = useRef((item: NeteaseAPI.NeteaseComment) => item.commentId);
  const render = useCallback(
    (item: NeteaseAPI.NeteaseComment) => <Item data={item} sourceID={sourceID} type={type} />,
    [sourceID, type]
  );

  return (
    <InfiniteList
      items={comments}
      hasMore={hasMore}
      isLoading={loading}
      buildKey={buildKey.current}
      className={cx("px-3 py-2", className)}
      render={render}
      onLoadMore={onEnded}
    />
  );
};

export default memo(Content);
