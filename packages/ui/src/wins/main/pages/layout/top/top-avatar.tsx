import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage } from "@/common/netease/models/netease-image";
import { NeteaseUser } from "@/common/netease/models";
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
        title={user.profile.nickname}
        preview={false}
        cache={true}
        image={avatar}
        className="size-full"
      />
    </div>
  );
};
export default memo(TopAvatar);
