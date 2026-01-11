import { FC, memo } from "react";
import { useFileCache } from "@mahiru/ui/public/hooks/useFileCache";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { useLocalStore } from "@mahiru/ui/public/store/local";

const TopAvatar: FC<object> = () => {
  const {
    User: { UserProfile }
  } = useLocalStore(["User"]);
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
