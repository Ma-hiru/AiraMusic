import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { PanelsTopLeft, RotateCwSquare } from "lucide-react";
import { NeteaseArtist } from "@/common/netease/models";
import { usePlaylistLayout } from "@/common/hooks/use-playlist-layout";
import PageAction from "@/common/components/display/page-action";
import IconButton from "@/common/components/data-input/icon-button";

import Info from "./info";
import Tabs from "./tabs";
import Avatar from "./avatar";

interface HeaderProps {
  className?: string;
  reload: NormalFunc;
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
  reload,
  tabsItem,
  activeIndex
}) => {
  const { toggleLayout } = usePlaylistLayout();
  return (
    <div className={cx("w-full", className)}>
      <div className="w-full min-h-50 flex justify-start items-start contain-strict">
        <Info className="min-h-50 flex-1" artist={artist} />
        <Avatar
          className="h-50 shrink-0 flex flex-col justify-end items-end gap-2 p-1 contain-layout"
          artist={artist}
          onAvatarLoaded={onAvatarLoaded}>
          <div className="flex flex-row justify-end items-center gap-2 contain-layout">
            <IconButton
              size="normal"
              variant="ghost"
              label="切换到详细版歌手"
              icon={PanelsTopLeft}
              onClick={toggleLayout}
            />
            <IconButton
              className="scale-110"
              label="刷新"
              size="normal"
              variant="ghost"
              icon={RotateCwSquare}
              onClick={reload}
            />
            <PageAction
              size="normal"
              variant="ghost"
              type={pageActionType}
              onClick={onPageAction}
            />
            <Tabs
              className="text-[12px] relative"
              tabsItem={tabsItem}
              activeIndex={activeIndex}
              onChange={onChange}
            />
          </div>
        </Avatar>
      </div>
      <div className="w-full h-0.5 my-2 bg-white/20" />
    </div>
  );
};

export default memo(Header);
