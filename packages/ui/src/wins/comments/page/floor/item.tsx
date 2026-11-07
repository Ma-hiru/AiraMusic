import { cx } from "@emotion/css";
import { ThumbsUp } from "lucide-react";
import { memo, type FC, useMemo } from "react";
import { RendererFormat } from "@/common/lib/format";
import { CommentType, NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useCommentLike } from "@/wins/comments/hooks/use-comment-like";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface FloorItemProps {
  sourceID?: number;
  className?: string;
  type?: CommentType;
  data: NeteaseAPI.NeteaseFloorComment;
  onLikedChange: NormalFunc<[commentId: number, liked: boolean]>;
}

const FloorItem: FC<FloorItemProps> = ({ className, onLikedChange, data, type, sourceID }) => {
  const { liked, toggle } = useCommentLike({
    commentId: data.commentId,
    initialLiked: data.liked,
    sourceID,
    type,
    onLikedChange
  });

  // 仅当被回复对象不是楼主时才补「回复 @某人」，避免直回楼主时冗余
  const quote = useMemo(() => {
    const replied = data.beReplied?.[data.beReplied.length - 1];
    if (!replied || replied.beRepliedCommentId === data.parentCommentId) return null;
    return replied.user?.nickname ?? null;
  }, [data.beReplied, data.parentCommentId]);

  return (
    <div
      className={cx(
        "text-sm font-medium flex flex-row items-start justify-start gap-2 min-w-0",
        className
      )}>
      <NeteaseImage
        className="size-6 rounded-full shrink-0 border"
        image={NeteaseNetworkImage.fromURL(data.user?.avatarUrl)
          ?.setSize(NeteaseImageSize.sm)
          .setAlt(data.user?.nickname)}
        cache
        cacheLazy
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex flex-row flex-wrap items-baseline gap-x-1">
          <span className="font-semibold text-[10px] truncate max-w-full">
            {data.user?.nickname}
          </span>
          <span className="opacity-50 text-[9px] font-medium whitespace-nowrap">
            {data.ipLocation?.location} {RendererFormat.time(data.time)}
          </span>
        </div>
        <p className="text-[11px] font-medium leading-[1.5] select-text whitespace-pre-wrap break-words">
          {quote && (
            <span className="opacity-60">
              回复 <span className="text-primary">@{quote}</span>：
            </span>
          )}
          {data.content}
        </p>
        <div
          className={cx(
            "text-[10px] opacity-80 font-medium flex flex-row items-center justify-end gap-1 px-1 rounded-md cursor-pointer"
          )}
          onClick={toggle}>
          <ThumbsUp
            className={cx("size-2.5 inline-block", liked && "text-primary")}
            fill={liked ? "currentColor" : "transparent"}
          />
          <span className={cx("leading-3", liked && "text-primary")}>
            {RendererFormat.count(data.likedCount)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(FloorItem);
