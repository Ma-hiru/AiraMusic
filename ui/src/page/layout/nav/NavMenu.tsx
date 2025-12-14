import { FC, memo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { NAV_DATA } from "@mahiru/ui/router";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import NavItem from "./NavItem";
import { Auth } from "@mahiru/ui/utils/auth";
import { useLogin } from "@mahiru/ui/hook/useLogout";

const NavMenu: FC<object> = () => {
  const { userLikedListSummary } = usePersistZustandShallowStore(["userLikedListSummary"]);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const [searchParams] = useSearchParams();
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
              (label === "喜欢" && location.pathname === `/playlist/${userLikedListSummary?.id}`) ||
              (label === "推荐" && searchParams.get("source") === "recommend")
            }
            onClick={() => {
              if (label === "喜欢") {
                if (userLikedListSummary?.id) {
                  if (Auth.isAccountLoggedIn()) {
                    navigate(`/playlist/${userLikedListSummary.id}?like=true&history=false`);
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
