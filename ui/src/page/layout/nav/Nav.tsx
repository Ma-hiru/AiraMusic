import { FC, memo } from "react";
import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideNavItem from "@mahiru/ui/page/layout/nav/NavItem";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useNavigate, useLocation } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";
import NavPlayList from "@mahiru/ui/page/layout/nav/NavPlayList";

const Nav: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 w-48 pb-18 px-6 bg-[#f0f3f6] z-0">
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
              active={location.pathname === path}
              onClick={() => navigate(path)}>
              {label}
            </NavSideNavItem>
          );
        })}
      </div>
      {!!data?.userPlayLists?.length && <NavSideDivider />}
      {/*playList*/}
      <NavPlayList />
    </div>
  );
};
export default memo(Nav);
