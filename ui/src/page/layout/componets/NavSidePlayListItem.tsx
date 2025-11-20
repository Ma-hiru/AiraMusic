import { FC, memo, useEffect, useState } from "react";
import NavSideNavItem from "@mahiru/ui/page/layout/componets/NavSideNavItem";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

interface Props {
  cover: string;
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
}

const NavSidePlayListItem: FC<Props> = ({ cover, label, count, id, onClick, active }) => {
  const [cacheCover, setCacheCover] = useState<Nullable<string>>(null);
  useEffect(() => {
    wrapCacheUrl(cover).then(setCacheCover);
  }, [cover]);
  return (
    <div className="space-x-2 font-bold">
      <NavSideNavItem
        active={active}
        onClick={() => onClick?.(id)}
        prefix={
          <div className="size-10 min-w-10 rounded-md overflow-hidden">
            <img className="w-full" src={cacheCover as string} alt={label} />
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
export default memo(NavSidePlayListItem);
