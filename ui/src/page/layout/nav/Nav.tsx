import { FC, memo } from "react";
import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import { useLayoutStatus, usePersistZustandShallowStore } from "@mahiru/ui/store";
import NavPlayList from "@mahiru/ui/page/layout/nav/NavPlaylist";
import { cx } from "@emotion/css";
import NavMenu from "@mahiru/ui/page/layout/nav/NavMenu";

const Nav: FC<object> = () => {
  const { userPlaylistSummary } = usePersistZustandShallowStore(["userPlaylistSummary"]);
  const { background, sideBarOpen } = useLayoutStatus(["background", "sideBarOpen"]);
  return (
    <div
      className={cx(
        "absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 pb-18 px-4 backdrop-blur-lg z-10 ease-in-out duration-300 transition-all border-r border-r-gray-500/10 contain-layout",
        background ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]",
        sideBarOpen ? "w-44" : "w-22"
      )}>
      <Avatar />
      <NavMenu />
      {!!userPlaylistSummary?.length && <NavSideDivider />}
      <NavPlayList />
    </div>
  );
};
export default memo(Nav);
