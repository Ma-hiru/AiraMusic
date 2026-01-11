import { FC, memo } from "react";

import NavItem from "./NavItem";
import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage";

interface Props {
  cover: string;
  label: string;
  count: number | string;
  id: number | string;
  onClick?: (id: number | string) => void;
  active?: boolean;
  fastLocation?: boolean;
  isMainColorDark: boolean;
}

const NavPlaylistItem: FC<Props> = ({
  cover,
  label,
  count,
  id,
  onClick,
  active,
  isMainColorDark,
  fastLocation
}) => {
  return (
    <NavItem
      active={active}
      onClick={() => onClick?.(id)}
      prefix={
        <div className="size-10 min-w-10 rounded-md overflow-hidden">
          <NeteaseImage
            pause={fastLocation}
            className="w-full"
            src={cover}
            alt={label}
            size={74}
            shadowColor={isMainColorDark ? "dark" : "light"}
          />
        </div>
      }>
      <div className="flex flex-col overflow-hidden pl-2 truncate">
        <span className="text-[12px] font-normal truncate">{label}</span>
        <span className="text-[10px] font-light truncate">{count}首</span>
      </div>
    </NavItem>
  );
};
export default memo(NavPlaylistItem);
