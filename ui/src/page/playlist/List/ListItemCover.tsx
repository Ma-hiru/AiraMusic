import { FC, memo } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useBlobOrFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";

interface ListItemCoverProps {
  track: NeteaseTrack;
}

const ListItemCover: FC<ListItemCoverProps> = ({ track }) => {
  const sizedURL = setImageURLSize(track.al.picUrl, "xs");
  const cachedURL = useBlobOrFileCache(sizedURL);
  return <img src={cachedURL} className="size-8 rounded-md" alt={track.al.name} />;
};
export default memo(ListItemCover);
