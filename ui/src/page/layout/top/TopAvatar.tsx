import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

const TopAvatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedAvatar = useFileCache(setImageURLSize(data.user?.avatarUrl, "sm"));
  return (
    <div>
      <img className="size-6 rounded-full" src={cachedAvatar} alt={data.user?.nickname} />
    </div>
  );
};
export default memo(TopAvatar);
