import { FC, memo } from "react";
import { NAV_DATA } from "@mahiru/ui/router";
import { Auth } from "@mahiru/ui/utils/auth";
import { useLogin } from "@mahiru/ui/hook/useLogout";
import { usePlaylistRouter } from "@mahiru/ui/hook/usePlaylistRouter";
import NavItem from "./NavItem";
import { useUserStore } from "@mahiru/ui/store/user";

const NavMenu: FC<object> = () => {
  const login = useLogin();
  const { UserLikedListSummary } = useUserStore(["UserLikedListSummary"]);
  const { shouldPlaylistIDIs, location, getPlaylistSource, goToPlaylistPage, navigate } =
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
              (label === "喜欢" && shouldPlaylistIDIs(UserLikedListSummary?.id)) ||
              (label === "推荐" && getPlaylistSource() === "recommend")
            }
            onClick={() => {
              if (label === "喜欢") {
                if (UserLikedListSummary?.id) {
                  if (Auth.isAccountLoggedIn()) {
                    goToPlaylistPage(UserLikedListSummary.id, "like");
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
