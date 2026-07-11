import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { NeteaseArtist } from "@/common/netease/models";
import PageAction from "@/common/components/display/page-action";

import Info from "./info";
import Tabs from "./tabs";
import Avatar from "./avatar";

interface HeaderProps {
  className?: string;
  tabsItem: string[];
  activeIndex: number;
  artist: Nullable<NeteaseArtist>;
  pageActionType?: "out" | "none" | "enter";
  onPageAction?: NormalFunc;
  onChange?: NormalFunc<[index: number]>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
}

const Header: FC<HeaderProps> = ({
  className,
  pageActionType = "none",
  onChange,
  onPageAction,
  onAvatarLoaded,
  artist,
  tabsItem,
  activeIndex
}) => {
  return (
    <div className={cx("w-full", className)}>
      <div className="w-full h-49 flex flex-row-reverse justify-start items-start">
        <Avatar className="h-full shrink-0" artist={artist} onAvatarLoaded={onAvatarLoaded} />
        <Info className="h-full flex-1" artist={artist}>
          <div className="flex mt-2 flex-row justify-end items-center">
            <span className="relative left-2">
              <PageAction type={pageActionType} onClick={onPageAction} />
            </span>
            <Tabs
              className="text-[12px] relative left-6"
              tabsItem={tabsItem}
              activeIndex={activeIndex}
              onChange={onChange}
            />
          </div>
        </Info>
      </div>
      <div className="w-full h-0.5 my-2 bg-[#7b8290]/10" />
    </div>
  );
};

export default memo(Header);
