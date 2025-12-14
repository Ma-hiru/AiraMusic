import { FC, memo, SyntheticEvent, useCallback } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";

interface Props {
  cover: { raw: string; cached: string; cacheID: string };
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  index: number;
  rawList: NeteasePlaylistSummary[];
}

const NavPlaylistItem: FC<Props> = ({
  cover,
  label,
  count,
  id,
  onClick,
  active,
  index,
  rawList
}) => {
  const cachedCover = useFileCache(
    Filter.NeteaseImageSize(cover.cached || cover.raw, ImageSize.sm),
    {
      onCacheHit: (file, id) => {
        if (rawList[index]) {
          rawList[index].cachedCoverImgUrl = file;
          rawList[index].cachedCoverImgUrlID = id;
        }
      }
    }
  );
  const onImageError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = Filter.NeteaseImageSize(cover.raw, ImageSize.sm) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      if (rawList[index]) {
        rawList[index].cachedCoverImgUrl = "";
        void CacheStore.remove(rawList[index].cachedCoverImgUrlID);
        rawList[index].cachedCoverImgUrlID = "";
      }
    },
    [cover.raw, index, rawList]
  );
  return (
    <NavSideNavItem
      active={active}
      onClick={() => onClick?.(id)}
      prefix={
        <div className="size-10 min-w-10 rounded-md overflow-hidden">
          <img className="w-full" src={cachedCover} alt={label} onError={onImageError} />
        </div>
      }>
      <div className="flex flex-col overflow-hidden pl-2 truncate">
        <span className="text-[12px] font-normal truncate">{label}</span>
        <span className="text-[10px] font-light truncate">{count}首</span>
      </div>
    </NavSideNavItem>
  );
};
export default memo(NavPlaylistItem);
