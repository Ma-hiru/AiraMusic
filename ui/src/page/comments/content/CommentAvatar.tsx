import { FC, memo } from "react";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";

interface CommentAvatarProps {
  avatar: Undefinable<string>;
  nickname: string;
}

const CommentAvatar: FC<CommentAvatarProps> = ({ avatar, nickname }) => {
  return (
    <div className="size-8">
      <img
        className="select-none w-full h-full rounded-full object-cover shadow-2xs border"
        src={Filter.NeteaseImageSize(avatar, ImageSize.xs)}
        alt={nickname}
        loading="lazy"
        decoding="auto"
      />
    </div>
  );
};
export default memo(CommentAvatar);
