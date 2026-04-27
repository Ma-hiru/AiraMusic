import { FC, memo, useEffect, useRef } from "react";
import { cx } from "@emotion/css";
import { Log } from "@mahiru/ui/public/utils/dev";

import Item from "./Item";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

interface ContentProps {
  comments: NeteaseAPI.NeteaseComment[];
  onEnded: NormalFunc;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({
    hasMore,
    loading
  });
  propsRef.current = {
    hasMore,
    loading
  };

  useEffect(() => {
    const root = rootRef.current;
    const target = loadingRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const { hasMore, loading } = propsRef.current;
        if (!hasMore || loading) return;
        if (entries[0]?.isIntersecting) {
          Log.info("comments soon ended, load more");
          onEnded();
        }
      },
      {
        root,
        rootMargin: "150px",
        threshold: 0
      }
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, onEnded]);

  return (
    <div
      ref={rootRef}
      className={cx("w-full overflow-y-auto scrollbar scrollbar-show px-3 py-2", className)}>
      {comments.map((item) => (
        <Item key={item.commentId} data={item} sourceID={sourceID} type={type} />
      ))}
      <AppLoading ref={loadingRef} wrap loading={hasMore} />
    </div>
  );
};

export default memo(Content);
