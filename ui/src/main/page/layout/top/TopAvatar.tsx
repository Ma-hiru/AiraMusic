import { FC, memo, useMemo } from "react";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { NeteaseNetworkImage } from "@mahiru/ui/public/models/netease/NeteaseImage";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";

const TopAvatar: FC<object> = () => {
  const { _user } = useUserStore();
  const avatar = useMemo(() => {
    return NeteaseNetworkImage.fromUserAvatar(NeteaseUser.fromObject(_user));
  }, [_user]);

  return (
    avatar && (
      <NeteaseImage
        preview={false}
        cache={true}
        image={avatar}
        className="size-5 rounded-full select-none"
      />
    )
  );
};
export default memo(TopAvatar);
