import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { useUserStore } from "@mahiru/ui/store/user";
import { NeteaseImage, NeteaseImageSize } from "@mahiru/ui/utils/image";

const TopAvatar: FC<object> = () => {
  const { UserProfile } = useUserStore(["UserProfile"]);
  const cachedAvatar = useFileCache(
    NeteaseImage.setSize(UserProfile?.avatarUrl, NeteaseImageSize.sm)
  );
  return (
    <div>
      <img
        className="size-5 rounded-full select-none"
        src={cachedAvatar}
        alt={UserProfile?.nickname}
      />
    </div>
  );
};
export default memo(TopAvatar);
