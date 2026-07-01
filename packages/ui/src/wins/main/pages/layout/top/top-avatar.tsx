import { memo, type FC, useMemo } from "react";
import { NeteaseUser } from "@/common/netease/models";
import { NeteaseNetworkImage } from "@/common/netease/models/netease-image";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TopAvatarProps {
  user: Nullable<NeteaseUser>;
}

const TopAvatar: FC<TopAvatarProps> = ({ user }) => {
  const avatar = useMemo(
    () =>
      NeteaseNetworkImage.fromUserAvatar(user)?.setSize(RendererImageConstants.TopMiniAvatarSize),
    [user]
  );

  if (!user || !user.isLoggedIn) return null;
  return (
    <div className="size-5 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)] overflow-hidden">
      <NeteaseImage
        className="size-full"
        cache={true}
        image={avatar}
        preview={false}
        title={user.profile.nickname}
      />
    </div>
  );
};
export default memo(TopAvatar);
