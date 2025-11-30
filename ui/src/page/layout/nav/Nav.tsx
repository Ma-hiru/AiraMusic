import { FC, memo } from "react";
import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";
import NavPlayList from "@mahiru/ui/page/layout/nav/NavPlayList";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";

const Nav: FC<object> = () => {
  const { getUserPlayListSummaryStatic, userLikedPlayList, _update } =
    useDynamicZustandShallowStore(["getUserPlayListSummaryStatic", "userLikedPlayList", "_update"]);
  const userPlayLists = getUserPlayListSummaryStatic();
  const navigate = useNavigate();
  const location = useLocation();
  const { background } = useLayout();
  return (
    <div
      className={cx(
        "absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 backdrop-blur-lg z-10",
        background ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]"
      )}>
      <div className="py-8">
        <BlobCachedProvider>
          <Avatar />
        </BlobCachedProvider>
      </div>
      {/*nav*/}
      <div className="space-y-4">
        {NAV_DATA.map(({ icon, label, path }) => {
          return (
            <NavSideNavItem
              key={label}
              prefix={icon}
              active={
                location.pathname === path ||
                (label === "搜藏" && location.pathname === `/playlist/${userLikedPlayList?.id}`)
              }
              onClick={() => {
                if (label === "搜藏" && (userLikedPlayList?.id || userLikedPlayList?.id === 0)) {
                  navigate(`/playlist/${userLikedPlayList.id}?like=true&history=false`);
                } else {
                  navigate(path);
                }
              }}>
              {label}
            </NavSideNavItem>
          );
        })}
      </div>
      {!!userPlayLists.length && <NavSideDivider key={_update} />}
      {/*playList*/}
      <NavPlayList />
    </div>
  );
};
export default memo(Nav);
