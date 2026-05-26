import { type FC, memo, useMemo } from "react";
import { NeteaseArtist } from "@/common/source/netease/models";

import Avatar from "./avatar";
import Info from "./info";
import Tabs from "./tabs";
import { cx } from "@emotion/css";
import { SquareArrowRightEnter, SquareArrowRightExit } from "lucide-react";

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
  const action = useMemo(() => {
    if (pageActionType === "enter")
      return (
        <SquareArrowRightEnter
          className="size-5 hover:opacity-50 ease-in-out transition-all duration-300 cursor-pointer active:scale-90"
          onClick={onPageAction}
        />
      );
    if (pageActionType === "out")
      return (
        <SquareArrowRightExit
          className="size-5 hover:opacity-50 ease-in-out transition-all duration-300 cursor-pointer active:scale-90"
          onClick={onPageAction}
        />
      );
    return null;
  }, [onPageAction, pageActionType]);
  return (
    <div className={cx("w-full", className)}>
      <div className="w-full h-49 flex flex-row-reverse justify-start items-start">
        <Avatar className="h-full shrink-0" artist={artist} onAvatarLoaded={onAvatarLoaded} />
        <Info className="h-full flex-1" artist={artist}>
          <div className="flex mt-2 flex-row justify-end items-center">
            <span className="relative left-2">{action}</span>
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
