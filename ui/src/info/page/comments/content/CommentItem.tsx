import { FC, memo } from "react";
import { CommentType } from "@mahiru/ui/public/enum";

import CommentAvatar from "./CommentAvatar";
import CommentAction from "./CommentAction";
import CommentContent from "./CommentContent";

interface CommentItemProps {
  comment: NeteaseComment;
  type: CommentType;
  sourceId: number;
  mainColor: string;
  textColorOnMain: string;
  secondaryColor: string;
  isMainColorDark: boolean;
}

const CommentItem: FC<CommentItemProps> = ({
  comment,
  type,
  sourceId,
  mainColor,
  textColorOnMain,
  secondaryColor,
  isMainColorDark
}) => {
  return (
    <div className="m-0 p-0" style={{ color: mainColor }}>
      <div className="py-4 px-1 font-semibold grid grid-rows-1 grid-cols-[auto_1fr] gap-2 items-start relative">
        <CommentAvatar
          avatar={comment.user.avatarUrl}
          nickname={comment.user.nickname}
          isMainColorDark={isMainColorDark}
        />
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
