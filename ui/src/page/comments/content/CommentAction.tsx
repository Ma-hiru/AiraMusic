import { FC, memo, useCallback, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { API } from "@mahiru/ui/api";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { CommentType } from "@mahiru/ui/api/comment";

interface CommentActionProps {
  comment: NeteaseComment;
  type: CommentType;
  sourceId: number;
  mainColor: string;
  textColorOnMain: string;
  secondaryColor: string;
}

const CommentAction: FC<CommentActionProps> = ({
  comment,
  type,
  sourceId,
  mainColor,
  secondaryColor,
  textColorOnMain
}) => {
  const [liked, setLiked] = useState(comment.liked);
  const [likedCount, setLikedCount] = useState(comment.likedCount);
  const likeComment = useCallback(() => {
    API.Comment.likeComment({
      type,
      id: sourceId,
      t: liked ? 0 : 1,
      cid: comment.commentId
    })
      .then((response) => {
        if (response.code === 200) {
          setLiked(!liked);
          comment.liked = !liked;
          setLikedCount((p) => (liked ? p - 1 : p + 1));
          comment.likedCount = liked ? comment.likedCount - 1 : comment.likedCount + 1;
        }
      })
      .catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            label: "CommentItem.tsx",
            message: "fail to like comment"
          })
        );
        // TODO : 提示用户点赞失败
      });
  }, [comment, liked, sourceId, type]);
  return (
    <div className="absolute right-0 bottom-1.5 flex justify-end items-center select-none">
      <div className="flex justify-center items-center gap-1">
        <p className="text-[8px] sm:text-[10px] relative top-0.5">{likedCount}</p>
        <ThumbsUp
          className="size-3.5 sm:size-4 hover:opacity-50 cursor-pointer active:scale-90 duration-300 ease-in-out transition-all  "
          onClick={likeComment}
          color={mainColor}
          fill={liked ? mainColor : "transparent"}
        />
      </div>
    </div>
  );
};
export default memo(CommentAction);
