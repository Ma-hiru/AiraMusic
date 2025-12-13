import { FC, memo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import NavItem from "./NavItem";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const NavMenu: FC<object> = () => {
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const { sideBarOpen } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  return (
    <div className="space-y-4">
      {NAV_DATA.map(({ icon, label, path }) => {
        return (
          <NavItem
            key={label}
            prefix={icon}
            active={
              location.pathname === path ||
              (label === "搜藏" && location.pathname === `/playlist/${userLikedListSummary?.id}`) ||
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
            {sideBarOpen && <span className="truncate pl-2">{label}</span>}
          </NavItem>
        );
      })}
    </div>
  );
};
export default memo(NavMenu);
