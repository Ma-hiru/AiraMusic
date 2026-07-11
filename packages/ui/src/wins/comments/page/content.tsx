import { cx } from "@emotion/css";
import { memo, useRef, type FC, useCallback } from "react";
import InfiniteList from "@/common/components/layout/infinite/infinite-list";

import Item from "./item";

interface ContentProps {
  hasMore: boolean;
  loading: boolean;
  sourceID?: number;
  className?: string;
  comments: NeteaseAPI.NeteaseComment[];
  type?: "album" | "track" | "playlist";
  onEnded: NormalFunc | PromiseFunc;
}

const Content: FC<ContentProps> = ({
  className,
  onEnded,
  type,
  hasMore,
  loading,
  comments,
  sourceID
}) => {
  const buildKey = useRef((item: NeteaseAPI.NeteaseComment) => item.commentId);
  const render = useCallback(
    (item: NeteaseAPI.NeteaseComment) => <Item data={item} type={type} sourceID={sourceID} />,
    [sourceID, type]
  );

  return (
    <InfiniteList
      className={cx("px-3 py-2", className)}
      render={render}
      items={comments}
      hasMore={hasMore}
      isLoading={loading}
      buildKey={buildKey.current}
      onLoadMore={onEnded}
    />
  );
};

export default memo(Content);
