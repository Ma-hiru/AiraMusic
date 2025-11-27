import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

const TopAvatar: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedAvatar = useFileCache(NeteaseImageSizeFilter(data.user?.avatarUrl, ImageSize.sm));
  return (
    <div>
      <img className="size-5 rounded-full" src={cachedAvatar} alt={data.user?.nickname} />
    </div>
  );
};
export default memo(TopAvatar);
