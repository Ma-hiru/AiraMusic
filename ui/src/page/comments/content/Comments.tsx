import Color from "color";
import { FC, memo, useRef } from "react";
import CommentItem from "./CommentItem";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

interface CommentsProps {
  comments: NeteaseComment[];
  infoSync: InfoSync<"comments">;
  themeSync: InfoSync<"theme">;
}

const Comments: FC<CommentsProps> = ({ comments, infoSync, themeSync }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const isMainColorDark = Color(themeSync.value.mainColor).isDark();
  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="overflow-y-scroll scrollbar w-[90%] mx-auto pb-5 px-1.5">
      {comments.map((comment) => (
        <CommentItem
          key={comment.commentId}
          comment={comment}
          type={infoSync.value.type}
          sourceId={infoSync.value.id}
          mainColor={Color(themeSync.value.mainColor).darken(0.5).string()}
          secondaryColor={themeSync.value.secondaryColor}
          textColorOnMain={themeSync.value.textColor}
          isMainColorDark={isMainColorDark}
        />
      ))}
    </div>
  );
};
export default memo(Comments);
