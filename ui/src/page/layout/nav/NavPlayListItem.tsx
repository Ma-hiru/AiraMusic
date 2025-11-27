import { FC, memo, SyntheticEvent, useCallback } from "react";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import { useBlobOrFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { cx } from "@emotion/css";
import { getDynamicSnapshot, Store } from "@mahiru/ui/store";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

interface Props {
  cover: { raw: string; cached: string; cacheID: string };
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  className?: string;
  index: number;
}

const NavPlayListItem: FC<Props> = ({
  cover,
  label,
  className,
  count,
  id,
  onClick,
  active,
  index
}) => {
  const cachedCover = useBlobOrFileCache(
    NeteaseImageSizeFilter(cover.cached || cover.raw, ImageSize.sm),
    {
      onCacheHit: (file, id) => {
        const { getUserPlayListSummaryStatic } = getDynamicSnapshot();
        const userPlayLists = getUserPlayListSummaryStatic();
        userPlayLists[index]!.cachedCoverImgUrl = file;
        userPlayLists[index]!.cachedCoverImgUrlID = id;
      }
    }
  );
  const onError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = NeteaseImageSizeFilter(cover.raw, ImageSize.sm) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      console.log("nav Image load error:", cachedCover, "fallback to raw:", raw);
      const { getUserPlayListSummaryStatic } = getDynamicSnapshot();
      const userPlayLists = getUserPlayListSummaryStatic();
      if (userPlayLists[index]) {
        userPlayLists[index].cachedCoverImgUrl = "";
        void Store.remove(userPlayLists[index].cachedCoverImgUrlID);
        userPlayLists[index].cachedCoverImgUrlID = "";
      }
    },
    [cachedCover, cover.raw, index]
  );
  return (
    <div
      className={cx(
        "space-x-2 font-bold will-change-transform backface-hidden contain-paint",
        className
      )}>
      <NavSideNavItem
        active={active}
        onClick={() => onClick?.(id)}
        prefix={
          <div className="size-10 min-w-10 rounded-md overflow-hidden">
            <img className="w-full" src={cachedCover} alt={label} onError={onError} />
          </div>
        }>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[12px] font-normal truncate">{label}</span>
          <span className="text-[10px] font-light">{count}首</span>
        </div>
      </NavSideNavItem>
    </div>
  );
};
export default memo(NavPlayListItem);
