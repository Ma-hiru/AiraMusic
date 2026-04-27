import dayjs from "dayjs";
import { FC, memo, useEffect, useRef, useState } from "react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import { cx } from "@emotion/css";
import { ThumbsUp } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import { Log } from "@mahiru/ui/public/utils/dev";

interface ContentProps {
  comments: NeteaseAPI.NeteaseComment[];
  onEnded: NormalFunc;
  hasMore: boolean;
  loading: boolean;
  className?: string;
}

const Content: FC<ContentProps> = ({ className, comments, onEnded, hasMore, loading }) => {
  const { mainColor } = useThemeColor();
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
      className={cx(
        "w-full overflow-y-auto scrollbar scrollbar-show px-3 py-2 space-y-4",
        className
      )}>
      {comments.map((item) => (
        <div
          key={item.commentId}
          className="text-sm font-medium flex flex-row items-start justify-start gap-2">
          <NeteaseImage
            cache
            cacheLazy
            className="size-10 rounded-full shrink-0"
            image={NeteaseNetworkImage.fromURL(item.user.avatarUrl)
              ?.setSize(NeteaseImageSize.sm)
              .setAlt(item.user.nickname)}
          />
          <div className="space-y-1 w-full">
            <h1 className="font-semibold text-xs flex flex-col items-start justify-start">
              <span>{item.user.nickname}</span>
              <span className="text-xs text-[10px] opacity-80">
                {item.user.locationInfo} {dayjs(item.time).format("YYYY-MM-DD HH:mm")}
              </span>
            </h1>
            <p className="text-xs">{item.content}</p>
            <div
              style={{ color: item.liked ? mainColor.string() : undefined }}
              className="text-xs opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 py-0.5 rounded-md cursor-pointer">
              {item.liked ? (
                <ThumbsUp className="size-3 inline-block" fill={mainColor.string()} />
              ) : (
                <ThumbsUp className="size-3 inline-block" />
              )}
              <span className="leading-3">{formatLikedCount(item.likedCount)}</span>
            </div>
          </div>
        </div>
      ))}
      <AppLoading ref={loadingRef} wrap loading={hasMore} />
    </div>
  );
};

export default memo(Content);

function formatTime(time: number) {
  const before = dayjs(time);
  const now = dayjs();
  if (now.diff(before, "minute") <= 1) {
    return "刚刚";
  } else if (now.diff(before, "day") <= 0) {
    return before.format("HH:mm");
  }
  return dayjs(time).format("YYYY-MM-DD HH:mm");
}

function formatLikedCount(likedCount: number) {
  if (likedCount >= 1000) {
    return `${(likedCount / 1000).toFixed(1)}k`;
  }
  return likedCount;
}
