import { FC, memo } from "react";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import { useBlobOrFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { cx } from "@emotion/css";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";

interface Props {
  cover: string;
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  className?: string;
}

const NavPlayListItem: FC<Props> = ({ cover, label, className, count, id, onClick, active }) => {
  const cachedCover = useBlobOrFileCache(setImageURLSize(cover, "sm"));
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
            <img className="w-full" src={cachedCover} alt={label} />
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
