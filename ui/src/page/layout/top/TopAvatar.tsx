import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useUserStore } from "@mahiru/ui/store/user";

const TopAvatar: FC<object> = () => {
  const { UserProfile } = useUserStore(["UserProfile"]);
  const cachedAvatar = useFileCache(Filter.NeteaseImageSize(UserProfile?.avatarUrl, ImageSize.sm));
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
