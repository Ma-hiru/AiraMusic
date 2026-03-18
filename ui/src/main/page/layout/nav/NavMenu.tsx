import { FC, memo } from "react";
import { NavConstants, RoutePathConstants } from "@mahiru/ui/main/constants";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { useToast } from "@mahiru/ui/public/hooks/useToast";

interface NavMenuProps {
  barOpened: boolean;
}

const NavMenu: FC<NavMenuProps> = ({ barOpened }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { requestToast } = useToast();
  const { isLoggedIn } = useUserStore();
  return (
    <div className="flex flex-col gap-4 w-40 overflow-hidden">
      {NavConstants.navs.map(({ icon, label, path }) => {
        const active = RoutePathConstants.match(location, path);
        return (
          <div
            key={path}
            className={cx(
              `
              flex flex-row h-12 items-center mx-3 rounded-md
          `,
              active ? "bg-(--theme-color-main)" : barOpened && "hover:bg-black/5"
            )}
            onClick={() => {
              if (path === RoutePathConstants.like && !isLoggedIn()) {
                return requestToast({
                  type: "info",
                  text: "请先登录账号"
                });
              }
              !active && navigate(path);
            }}>
            <span
              className={cx(
                "w-[calc(50%-var(--spacing)*3)] h-full flex items-center justify-center font-bold rounded-md",
                !barOpened && "hover:bg-black/5"
              )}>
              {icon}
            </span>
            <span
              className={cx(
                `
                  w-[calc(50%+var(--spacing)*3)] h-full
                  flex items-center justify-start font-bold rounded-md
                  ease-in-out duration-300 transition-opacity
                `,
                !barOpened && "opacity-0"
              )}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
export default memo(NavMenu);
