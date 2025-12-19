import { FC, memo } from "react";
import { CacheStore } from "@mahiru/ui/store/cache";
import { ImageSize } from "@mahiru/ui/utils/filter";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface Props {
  cover: { raw: string; cached: string; cacheID: string };
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  index: number;
  isMainColorDark: boolean;
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
  rawList,
  isMainColorDark
}) => {
  return (
    <NavSideNavItem
      active={active}
      onClick={() => onClick?.(id)}
      prefix={
        <div className="size-10 min-w-10 rounded-md overflow-hidden">
          <NeteaseImage
            onCacheHit={(file, id) => {
              if (rawList[index]) {
                rawList[index].cachedCoverImgUrl = file;
                rawList[index].cachedCoverImgUrlID = id;
              }
            }}
            className="w-full"
            src={cover.cached || cover.raw}
            alt={label}
            onCacheError={() => {
              if (rawList[index]) {
                rawList[index].cachedCoverImgUrl = "";
                void CacheStore.remove(rawList[index].cachedCoverImgUrlID);
                rawList[index].cachedCoverImgUrlID = "";
              }
            }}
            size={ImageSize.sm}
            shadowColor={isMainColorDark ? "dark" : "light"}
          />
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
