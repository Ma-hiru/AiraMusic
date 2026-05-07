import { FC, memo } from "react";
import { NeteaseArtist } from "@mahiru/ui/public/source/netease/models";

import Avatar from "./Avatar";
import Info from "./Info";
import Tabs from "./Tabs";
import { cx } from "@emotion/css";

interface HeaderProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
  tabsItem: string[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
}

const Header: FC<HeaderProps> = ({
  artist,
  className,
  onAvatarLoaded,
  tabsItem,
  activeIndex,
  onChange
}) => {
  return (
    <div className={cx("w-full", className)}>
      <div className="w-full h-48 flex flex-row justify-start items-start gap-8">
        <Avatar className="h-full shrink-0" artist={artist} onAvatarLoaded={onAvatarLoaded} />
        <Info className="h-full flex-1" artist={artist}>
          <Tabs
            className="self-end text-[12px] mt-2"
            tabsItem={tabsItem}
            activeIndex={activeIndex}
            onChange={onChange}
          />
        </Info>
      </div>
      <div className="w-full h-0.5 my-4 bg-[#7b8290]/10" />
    </div>
  );
};

export default memo(Header);
