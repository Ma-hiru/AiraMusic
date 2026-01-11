import { FC, memo } from "react";

interface CommentContentProps {
  comment: NeteaseComment;
}

const CommentContent: FC<CommentContentProps> = ({ comment }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-start items-start flex-col">
        <p className="font-semibold text-[10px] sm:text-[12px]">{comment.user.nickname}</p>
        <p className="text-[9px] sm:text-[10px] opacity-30 space-x-2 select-none">
          <span>{comment?.timeStr}</span>
          <span>{comment?.ipLocation?.location || null}</span>
        </p>
      </div>
      <p className="text-[12px] sm:text-[14px] font-normal">{comment.content}</p>
    </div>
  );
};
export default memo(CommentContent);
