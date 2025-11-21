import { FC, memo } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useCache } from "@mahiru/ui/ctx/CachedCtx";

interface ListItemCoverProps {
  track: NeteaseTrack;
}

const ListItemCover: FC<ListItemCoverProps> = ({ track }) => {
  const { cachedURL, init, fail } = useCache(track.al.picUrl);
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
