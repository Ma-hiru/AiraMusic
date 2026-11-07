import { useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { CommentType } from "@/common/enum";
import { NeteaseAPIComment } from "@/common/netease/api";
import AppToast from "@/common/components/display/toast";

/**
 * 评论点赞：乐观更新，失败回滚
 * @desc 顶层评论与楼层评论共用
 * */
export function useCommentLike(props: {
  commentId: number;
  sourceID?: number;
  type?: CommentType;
  initialLiked: boolean;
  onLikedChange?: NormalFunc<[commentId: number, liked: boolean]>;
}) {
  const { onLikedChange, type, sourceID, commentId, initialLiked } = props;
  const [liked, setLiked] = useState(initialLiked);

  useEffect(() => setLiked(initialLiked), [commentId, initialLiked]);

  const toggle = useCallback(() => {
    if (sourceID == null || type == null) return;
    const next = !liked;
    setLiked(next);
    onLikedChange?.(commentId, next);
    NeteaseAPIComment.like({
      cid: commentId,
      id: sourceID,
      t: next ? 1 : 0,
      type
    }).catch((err) => {
      Log.error(err);
      AppToast.show({
        type: "error",
        text: "操作失败"
      });
      setLiked(!next);
      onLikedChange?.(commentId, !next);
    });
  }, [commentId, liked, onLikedChange, sourceID, type]);

  return { liked, toggle };
}
