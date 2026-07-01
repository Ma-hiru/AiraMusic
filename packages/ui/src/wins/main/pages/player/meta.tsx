import { cx } from "@emotion/css";
import { Heart, MessageSquare } from "lucide-react";
import { memo, type FC, useState, useEffect, useCallback } from "react";
import { useHeart } from "@/common/hooks/use-heart";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { CommentSort, CommentType } from "@/common/enum";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPITrack, NeteaseAPIComment } from "@/common/netease/api";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import Tag from "@/common/components/display/tag";
import RendererPlayerHandle from "@/wins/main/lib/handle";

interface ArtistProps {
  className?: string;
}

const Meta: FC<ArtistProps> = ({ className }) => {
  const player = RendererPlayerHandle.usePlayer();
  const quality = player.current.audio?.quality;
  const track = player.current.track?.detail;
  const [redCount, setRedCount] = useState<Nullable<number>>(null);
  const [commentCount, setCommentCount] = useState<Nullable<number>>(null);
  const { heartManager } = useUserTrackManager();
  const { checkLiked, likedChange } = useHeart(heartManager);

  const starTrack = useCallback(() => {
    const liked = likedChange(track);
    if (liked) setRedCount((r) => (r ?? 1) - 1);
  }, [likedChange, track]);

  const openComment = useCallback(async () => {
    if (!track) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({
      id: track.id,
      type: "track"
    });
  }, [track]);

  useEffect(() => {
    const id = track?.id;
    if (!id) {
      setCommentCount(null);
      setRedCount(null);
      return;
    }

    let cancel = false;
    NeteaseAPITrack.redCount(id)
      .then((res) => {
        if (cancel) return;
        setRedCount(res.data.count);
      })
      .catch(() => {
        if (cancel) return;
        setRedCount(null);
      });
    NeteaseAPIComment.get({
      id,
      type: CommentType.Song,
      pageSize: 1,
      pageNo: 1,
      sortType: CommentSort.Recommend
    })
      .then((res) => {
        if (cancel) return;
        setCommentCount(res.data.totalCount);
      })
      .catch(() => {
        if (cancel) return;
        setCommentCount(null);
      });

    return () => {
      cancel = true;
    };
  }, [track?.id]);

  return (
    <section
      className={cx(
        "relative flex flex-row justify-between gap-1 items-center flex-nowrap contain-layout",
        className
      )}>
      <div className="flex-1 flex justify-start gap-1">
        {quality && (
          <Tag
            className="w-fit! text-(--text-color)! bg-(--text-color)/30! text-[70%]"
            text={quality}
          />
        )}
      </div>
      <div className={cx("shrink-0 flex justify-center items-center gap-1")}>
        <section
          className={cx(
            "flex justify-center items-center gap-1 bg-white/30 rounded-full px-1.5 py-px hover:opacity-50 active:scale-98 cursor-pointer ease-in-out duration-300 transition-all",
            redCount === null && "bg-transparent!"
          )}
          onClick={starTrack}>
          {redCount !== null && (
            <span className="text-[70%] leading-normal">{RendererFormat.count(redCount)}</span>
          )}
          <Heart
            className="size-3.5 xl:size-4"
            color={checkLiked(track) ? "currentColor" : undefined}
            fill={checkLiked(track) ? "currentColor" : "transparent"}
          />
        </section>
        <section
          className={cx(
            "flex justify-center items-center gap-1 bg-white/30 rounded-full px-1.5 py-px hover:opacity-50 active:scale-98 cursor-pointer ease-in-out duration-300 transition-all",
            commentCount === null && "bg-transparent!"
          )}
          onClick={openComment}>
          {commentCount !== null && (
            <span className="text-[70%] leading-normal">{RendererFormat.count(commentCount)}</span>
          )}
          <MessageSquare
            className="size-3.5 scale-90 xl:size-4"
            fill="currentColor"
            color="currentColor"
          />
        </section>
      </div>
    </section>
  );
};

export default memo(Meta);
