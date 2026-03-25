import { FC, memo, useMemo } from "react";
import { NeteaseNetworkImage } from "@mahiru/ui/public/models/netease/NeteaseImage";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";
import ImageConstants from "@mahiru/ui/main/constants/image";

interface TopAvatarProps {
  user: Nullable<NeteaseUser>;
}

const TopAvatar: FC<TopAvatarProps> = ({ user }) => {
  const avatar = useMemo(
    () => NeteaseNetworkImage.fromUserAvatar(user)?.setSize(ImageConstants.TopMiniAvatarSize),
    [user]
  );
  return (
    avatar && (
      <NeteaseImage
        preview={false}
        cache={true}
        image={avatar}
        className="size-5 rounded-full select-none shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)]"
      />
    )
  );
};
export default memo(TopAvatar);
