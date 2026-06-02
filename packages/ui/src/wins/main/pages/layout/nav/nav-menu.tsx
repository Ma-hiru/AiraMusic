import { type FC, memo } from "react";
import { NavConstants } from "@/wins/main/constants";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { NeteaseUser } from "@/common/netease/models";
import { RoutePathMain } from "@/common/routes";
import AppToast from "@/common/components/toast";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";

interface NavMenuProps {
  barOpened: boolean;
}

const NavMenu: FC<NavMenuProps> = ({ barOpened }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { jumpPlaylistPage } = usePageJump();

  return (
    <div className="flex flex-col gap-4 w-(--side-bar-expand-width) overflow-hidden">
      {NavConstants.LAYOUT_NAV.map(({ icon, label, path }) => {
        const active = RoutePathMain.match(location, path);
        return (
          <div
            key={path}
            className={cx(
              `
              flex flex-row h-12 items-center mx-3 rounded-md
              ease-in-out duration-300 transition-all
              text-(--text-color-on-main)
          `,
              active ? barOpened && "bg-(--theme-color-main)" : barOpened && "hover:bg-black/5"
            )}
            onClick={() => {
              if (path === RoutePathMain.playlist.like && !NeteaseUser.isLoggedIn) {
                return AppToast.show({
                  type: "info",
                  text: "请先登录账号"
                });
              }
              if (active) return;
              if (path === RoutePathMain.playlist.like) {
                jumpPlaylistPage(0, "like");
              } else {
                navigate(path);
              }
            }}>
            <span
              className={cx(
                `
                    w-[calc(50%-var(--spacing)*3)] h-full
                    flex items-center justify-center font-bold rounded-md
                    ease-in-out duration-300 transition-all
                `,
                active ? "bg-(--theme-color-main)" : !barOpened && "hover:bg-black/5"
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
