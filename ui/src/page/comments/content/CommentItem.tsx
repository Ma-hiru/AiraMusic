import { FC, memo } from "react";
import { CommentType } from "@mahiru/ui/api/comment";
import CommentAvatar from "@mahiru/ui/page/comments/content/CommentAvatar";
import CommentAction from "@mahiru/ui/page/comments/content/CommentAction";
import CommentContent from "@mahiru/ui/page/comments/content/CommentContent";

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
  textColorOnMain,
  secondaryColor
}) => {
  return (
    <div className="m-0 p-0" style={{ color: mainColor }}>
      <div className="py-4 px-1 font-semibold grid grid-rows-1 grid-cols-[auto_1fr] gap-2 items-start relative">
        <CommentAvatar avatar={comment.user.avatarUrl} nickname={comment.user.nickname} />
        <CommentContent comment={comment} />
        <CommentAction
          type={type}
          sourceId={sourceId}
          comment={comment}
          textColorOnMain={textColorOnMain}
          secondaryColor={secondaryColor}
          mainColor={mainColor}
        />
      </div>
      <span className="block w-full h-px opacity-10" style={{ background: mainColor }} />
    </div>
  );
};
export default memo(CommentItem);
