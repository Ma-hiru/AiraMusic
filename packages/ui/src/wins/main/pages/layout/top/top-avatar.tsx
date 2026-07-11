import { memo, type FC, useMemo } from "react";
import { NeteaseUser } from "@/common/netease/models";
import { NeteaseNetworkImage } from "@/common/netease/models/netease-image";
import NoDrag from "@/common/components/layout/drag/no-drag";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TopAvatarProps {
  isDarwin?: boolean;
  playModal?: boolean;
  user: Nullable<NeteaseUser>;
  onClick?: NormalFunc;
}

const TopAvatar: FC<TopAvatarProps> = ({ user, onClick, isDarwin, playModal }) => {
  const avatar = useMemo(
    () =>
      NeteaseNetworkImage.fromUserAvatar(user)?.setSize(RendererImageConstants.TopMiniAvatarSize),
    [user]
  );

  if (!playModal && !isDarwin) return null;
  if (!user || !user.isLoggedIn) return null;
  return (
    <NoDrag className="size-5 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer">
      <NeteaseImage
        className="size-full"
        cache={true}
        image={avatar}
        preview={false}
        title={user.profile.nickname}
        onClick={onClick}
      />
    </NoDrag>
  );
};
export default memo(TopAvatar);
