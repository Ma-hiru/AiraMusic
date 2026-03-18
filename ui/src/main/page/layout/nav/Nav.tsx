import { FC, memo, useMemo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";

import NavPlayList from "./NavPlaylist";
import NavSideDivider from "./NavDivider";
import NavMenu from "./NavMenu";

const Nav: FC<object> = () => {
  const { _user } = useUserStore();
  const { layout, theme } = useLayoutStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);
  const displayPlaylist = (user?.playlistCount || 0) > 0;

  return (
    <div
      className={cx(
        `
          grid grid-cols-1
          pb-18 pt-11 overflow-hidden
          backdrop-blur-lg contain-layout
          ease-in-out duration-300 transition-all
          border-r border-r-gray-500/10
        `,
        theme.backgroundCover ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]",
        layout.sideBar ? "w-40" : "w-20"
      )}>
      <NavMenu barOpened={layout.sideBar} />
      {displayPlaylist && <NavSideDivider />}
      {displayPlaylist && <NavPlayList user={user} layout={layout} />}
    </div>
  );
};
export default memo(Nav);
