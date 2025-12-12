import { FC, memo } from "react";
import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import NavPlayList from "@mahiru/ui/page/layout/nav/NavPlayList";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";

const Nav: FC<object> = () => {
  const { userPlaylistSummary, userLikedListSummary } = usePersistZustandShallowStore([
    "userPlaylistSummary",
    "userLikedListSummary"
  ]);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { background } = useLayout();
  return (
    <div
      className={cx(
        "absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 backdrop-blur-lg z-10",
        background ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]"
      )}>
      <div className="py-8">
        <Avatar />
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
                (label === "搜藏" &&
                  location.pathname === `/playlist/${userLikedListSummary?.id}`) ||
                (label === "推荐" && searchParams.get("source") === "recommend")
              }
              onClick={() => {
                if (
                  label === "搜藏" &&
                  (userLikedListSummary?.id || userLikedListSummary?.id === 0)
                ) {
                  navigate(`/playlist/${userLikedListSummary.id}?like=true&history=false`);
                } else {
                  navigate(path);
                }
              }}>
              {label}
            </NavSideNavItem>
          );
        })}
      </div>
      {!!userPlaylistSummary?.length && <NavSideDivider />}
      {/*playList*/}
      <NavPlayList />
    </div>
  );
};
export default memo(Nav);
