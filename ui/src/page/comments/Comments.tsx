import { FC, memo, useRef } from "react";
import CommentItem from "@mahiru/ui/page/comments/item/CommentItem";
import Color from "color";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

interface CommentsProps {
  comments: NeteaseComment[];
  infoSync: InfoSync<"comments">;
}

const Comments: FC<CommentsProps> = ({ comments, infoSync }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="overflow-y-scroll scrollbar w-[90%] mx-auto pb-10">
      {comments.map((comment) => (
        <CommentItem
          key={comment.commentId}
          comment={comment}
          type={infoSync.value.type}
          sourceId={infoSync.value.id}
          mainColor={Color(infoSync.mainColor).darken(0.5).string()}
          secondaryColor={infoSync.secondaryColor}
          textColorOnMain={infoSync.textColor}
        />
      ))}
    </div>
  );
};
export default memo(Comments);
