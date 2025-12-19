import { FC, memo } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import NavItem from "./NavItem";
import { Auth } from "@mahiru/ui/utils/auth";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { usePlaylistRouter } from "@mahiru/ui/hook/usePlaylistRouter";

const NavMenu: FC<object> = () => {
  const login = useLogin();
  const navigate = useNavigate();
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const { shouldPlaylistIDIs, getPlaylistRouterPath, location, getPlaylistSource } =
    usePlaylistRouter();
  return (
    <div className="space-y-4 w-full overflow-hidden">
      {NAV_DATA.map(({ icon, label, path }) => {
        return (
          <NavItem
            key={label}
            prefix={
              <div className="size-10 min-w-10 rounded-md overflow-hidden items-center justify-center flex">
                {icon}
              </div>
            }
            active={
              location.pathname === path ||
              (label === "喜欢" && shouldPlaylistIDIs(userLikedListSummary?.id)) ||
              (label === "推荐" && getPlaylistSource() === "recommend")
            }
            onClick={() => {
              if (label === "喜欢") {
                if (userLikedListSummary?.id) {
                  if (Auth.isAccountLoggedIn()) {
                    navigate(getPlaylistRouterPath(userLikedListSummary.id, "like"));
                  } else {
                    login();
                  }
                }
              } else {
                navigate(path);
              }
            }}>
            <span className="truncate pl-1">{label}</span>
          </NavItem>
        );
      })}
    </div>
  );
};
export default memo(NavMenu);
