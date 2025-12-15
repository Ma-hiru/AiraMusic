import { FC, memo, useCallback, useState } from "react";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { ThumbsUp } from "lucide-react";
import { API } from "@mahiru/ui/api";
import { CommentType } from "@mahiru/ui/api/comment";
import { EqError, Log } from "@mahiru/ui/utils/dev";

interface CommentItemProps {
  comment: NeteaseComment;
  type: CommentType;
  sourceId: number;
  mainColor: string;
  textColorOnMain: string;
  secondaryColor: string;
}

const CommentItem: FC<CommentItemProps> = ({
  comment,
  type,
  sourceId,
  mainColor,
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
    <div className="m-0 p-0" style={{ color: mainColor }}>
      <div className="py-4 px-1 font-semibold grid grid-rows-1 grid-cols-[auto_1fr] gap-2 items-start relative">
        <div className="size-8">
          <img
            className="select-none w-full h-full rounded-full object-cover shadow-2xs border"
            src={Filter.NeteaseImageSize(comment.user.avatarUrl, ImageSize.xs)}
            alt={comment.user.nickname}
            loading="lazy"
            decoding="auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-start items-start flex-col">
            <p className="font-semibold text-[12px]">{comment.user.nickname}</p>
            <p className="text-[10px] opacity-30 space-x-2 select-none">
              <span>{comment.timeStr}</span>
              <span>{comment.ipLocation.location || null}</span>
            </p>
          </div>
          <p className="text-[14px] font-normal">{comment.content}</p>
        </div>
        <div className="absolute right-0 bottom-1.5 flex justify-end items-center select-none">
          <div className="flex justify-center items-center gap-1">
            <p className="text-[10px] relative top-0.5">{likedCount}</p>
            <ThumbsUp
              className="size-4 hover:opacity-50 cursor-pointer active:scale-90 duration-300 ease-in-out transition-all  "
              onClick={likeComment}
              color={mainColor}
              fill={liked ? mainColor : "transparent"}
            />
          </div>
        </div>
      </div>
      <span className="block w-full h-px opacity-20" style={{ background: mainColor }} />
    </div>
  );
};
export default memo(CommentItem);
