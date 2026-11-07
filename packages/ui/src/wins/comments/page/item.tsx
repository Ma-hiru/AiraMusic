import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { ThumbsUp, ChevronUp, ChevronDown } from "lucide-react";
import { RendererFormat } from "@/common/lib/format";
import { CommentType, NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useCommentFloor } from "@/common/hooks/use-comment-floor";
import { useCommentLike } from "@/wins/comments/hooks/use-comment-like";
import NeteaseImage from "@/common/components/display/image/netease-image";

import FloorList from "./floor/list";

interface ItemProps {
  small?: boolean;
  avatar?: boolean;
  border?: boolean;
  reverse?: boolean;
  sourceID?: number;
  data: NeteaseAPI.NeteaseComment;
  type?: "album" | "track" | "playlist";
}

const Item: FC<ItemProps> = ({
  data,
  type,
  sourceID,
  avatar = true,
  border = true,
  small = false,
  reverse = false
}) => {
  const commentType = useMemo(() => {
    switch (type) {
      case "track":
        return CommentType.Song;
      case "album":
        return CommentType.Album;
      case "playlist":
        return CommentType.Playlist;
      default:
        return undefined;
    }
  }, [type]);
  const floor = useCommentFloor({
    id: sourceID,
    type: commentType,
    parentCommentId: data.commentId
  });
  const { mainColor } = useThemeColor();
  const { liked, toggle: toggleLike } = useCommentLike({
    commentId: data.commentId,
    initialLiked: data.liked,
    sourceID,
    type: commentType
  });

  // 列表只返回 replyCount，楼层接口返回的 totalCount 更准，取较大值兜底
  const replyCount = Math.max(data.replyCount || 0, floor.total);
  // 只有完整版使用floor（比如radio评论显示时不使用）
  const showFloor = Boolean(avatar && !reverse && sourceID && commentType != null && replyCount);

  return (
    <>
      {border && <div className="border-b border-white/30 m-2" />}
      <div
        key={data.commentId}
        className={cx(
          "text-sm font-medium flex flex-row items-start justify-start gap-2",
          reverse && "flex-row-reverse",
          !avatar && "block"
        )}>
        {avatar && (
          <NeteaseImage
            className={cx(
              `
            size-8 rounded-full shrink-0 border cursor-pointer
            ease-in-out duration-300 transition-opacity hover:opacity-50
           `,
              small && "size-6!"
            )}
            shadow="base"
            image={NeteaseNetworkImage.fromURL(data.user.avatarUrl)
              ?.setSize(NeteaseImageSize.sm)
              .setAlt(data.user.nickname)}
            cache
            preview
            cacheLazy
          />
        )}
        <div
          className={cx("space-y-1 w-full min-w-0 flex flex-col", reverse && "flex-col-reverse")}>
          <h1
            className={cx(
              "font-semibold text-xs flex flex-col items-start justify-start",
              small && "text-[10px]!",
              reverse && "text-right! items-end!"
            )}>
            <span>{data.user.nickname}</span>
            <span className={cx("opacity-50 text-xs text-[10px]", small && "text-[8px]!")}>
              {data.ipLocation?.location} {RendererFormat.time(data.time)}
            </span>
          </h1>
          <p
            className={cx(
              "text-xs select-text rounded-lg rounded-tl-none wrap-break-word whitespace-pre-wrap",
              small && "text-[10.5px]!",
              !avatar && "p-1"
            )}>
            {!avatar && <span>『 </span>}
            {data.content}
            {!avatar && <span> 』</span>}
          </p>
          <div
            className={cx("flex flex-row items-center justify-between gap-2", !avatar && "hidden")}>
            {showFloor && (
              <button
                className={cx(
                  "flex flex-row items-center justify-start gap-x-1 min-w-0",
                  "text-[10.5px] font-medium cursor-pointer opacity-80",
                  "hover:opacity-100 ease-in-out duration-300 transition-opacity"
                )}
                type="button"
                onClick={floor.toggle}>
                <span>共</span>
                <span className="font-semibold">{RendererFormat.count(replyCount)}</span>
                <span>条回复</span>
                {floor.expanded ? (
                  <ChevronUp className="size-3 opacity-60" />
                ) : (
                  <ChevronDown className="size-3 opacity-60" />
                )}
              </button>
            )}
            <div
              className={cx(
                "text-xs opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 py-0.5 rounded-md cursor-pointer ml-auto shrink-0",
                small && "text-[10.5px]!"
              )}
              style={{ color: liked ? mainColor.string() : undefined }}
              onClick={toggleLike}>
              <ThumbsUp
                className={cx("size-3 inline-block", liked && "text-primary")}
                fill={liked ? "currentColor" : "transparent"}
              />
              <span className={cx("leading-3", liked && "text-primary")}>
                {RendererFormat.count(data.likedCount)}
              </span>
            </div>
          </div>
          {showFloor && floor.expanded && (
            <FloorList
              total={replyCount}
              type={commentType}
              sourceID={sourceID}
              floors={floor.floors}
              status={floor.status}
              hasMore={floor.hasMore}
              onRetry={floor.retry}
              onCollapse={floor.collapse}
              onLoadMore={floor.loadMore}
              onLikedChange={floor.updateLiked}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default memo(Item);
