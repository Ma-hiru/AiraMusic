import { FC, memo } from "react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

interface CommentAvatarProps {
  avatar: Undefinable<string>;
  nickname: string;
  isMainColorDark: boolean;
}

const CommentAvatar: FC<CommentAvatarProps> = ({ avatar, nickname, isMainColorDark }) => {
  return (
    <NeteaseImage
      className="size-8 select-none rounded-full border"
      src={avatar}
      size={NeteaseImageSize.xs}
      alt={nickname}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};
export default memo(CommentAvatar);
