import { FC, memo } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useCache } from "@mahiru/ui/ctx/CachedCtx";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";

interface ListItemCoverProps {
  track: NeteaseTrack;
}

const ListItemCover: FC<ListItemCoverProps> = ({ track }) => {
  const { cachedURL, init, fail } = useCache(track.al.picUrl, null, "sm");
  return (
    <img
      src={cachedURL as string}
      onLoad={init}
      onError={fail}
      className="size-8 rounded-md"
      alt={track.al.name}
    />
  );
};
export default memo(ListItemCover);
