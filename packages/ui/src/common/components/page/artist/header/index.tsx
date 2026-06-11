import { type FC, memo } from "react";
import { NeteaseArtist } from "@/common/netease/models";

import Avatar from "./avatar";
import Info from "./info";
import Tabs from "./tabs";
import { cx } from "@emotion/css";
import PageAction from "@/common/components/display/page-action";

interface HeaderProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
  onAvatarLoaded?: NormalFunc<[avatar: string]>;
  tabsItem: string[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const Header: FC<HeaderProps> = ({
  artist,
  className,
  onAvatarLoaded,
  tabsItem,
  activeIndex,
  onChange,
  pageActionType = "none",
  onPageAction
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
