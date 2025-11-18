import { FC, memo } from "react";
import NavSideNavItem from "@mahiru/ui/page/layout/componets/NavSideNavItem";

interface Props {
  cover: string;
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
}

const NavSidePlayListItem: FC<Props> = ({ cover, label, count, id, onClick, active }) => {
  return (
    <div className="space-x-2 font-bold">
      <NavSideNavItem
        active={active}
        onClick={() => onClick?.(id)}
        prefix={
          <div className="size-10 min-w-10 rounded-md overflow-hidden">
            <img className="w-full" src={cover} alt={label} />
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
