import { FC, memo, SyntheticEvent, useCallback } from "react";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { cx } from "@emotion/css";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";

interface Props {
  cover: { raw: string; cached: string; cacheID: string };
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  className?: string;
  index: number;
  rawList: NeteasePlaylistSummary[];
}

const NavPlayListItem: FC<Props> = ({
  cover,
  label,
  className,
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
  const onError = useCallback(
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
    <div
      className={cx(
        "space-x-2 font-bold will-change-transform backface-hidden contain-paint",
        className
      )}>
      <NavSideNavItem
        active={active}
        className="justify-start"
        onClick={() => onClick?.(id)}
        prefix={
          <div className="size-10 min-w-10 rounded-md overflow-hidden">
            <img className="w-full" src={cachedCover} alt={label} onError={onError} />
          </div>
        }>
        <div className="flex flex-col overflow-hidden pl-2">
          <span className="text-[12px] font-normal truncate">{label}</span>
          <span className="text-[10px] font-light">{count}首</span>
        </div>
      </NavSideNavItem>
    </div>
  );
};
export default memo(NavPlayListItem);
