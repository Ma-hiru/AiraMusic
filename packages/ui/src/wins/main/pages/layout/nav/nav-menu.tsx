import { type FC, memo, useCallback } from "react";
import { NavConstants } from "@/wins/main/constants";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { NeteaseUser } from "@/common/netease/models";
import { RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import AppToast from "@/common/components/display/toast";

interface NavMenuProps {
  barOpened: boolean;
  className?: string;
}

const NavMenu: FC<NavMenuProps> = ({ barOpened, className }) => {
  const { jumpPlaylistPage, jumpHistoryPage } = usePageJump();
  const location = useLocation();
  const navigate = useNavigate();

  const jump = useCallback(
    (path: string, active: boolean) => {
      if (active) return;
      if (path === RoutePathMain.history) return jumpHistoryPage();
      if (path === RoutePathMain.playlist.like) {
        if (!NeteaseUser.isLoggedIn) {
          return AppToast.show({
            type: "info",
            text: "请先登录账号"
          });
        }
        return jumpPlaylistPage(0, "like");
      }
      return navigate(path);
    },
    [jumpHistoryPage, jumpPlaylistPage, navigate]
  );

  return (
    <div
      className={cx(
        "flex flex-col gap-4 w-(--side-bar-expand-width) overflow-hidden contain-layout",
        className
      )}>
      {NavConstants.LAYOUT_NAV.map(({ icon, label, path }) => {
        const active = RoutePathMain.matchPathname(location, path);
        return (
          <div
            key={path}
            className={cx(
              `
              flex flex-row h-12 items-center mx-3 rounded-md
              ease-in-out duration-300 transition-all
            `,
              active
                ? barOpened && "bg-(--theme-color-main) text-(--text-color-on-main)"
                : barOpened && "hover:bg-black/5"
            )}
            onClick={() => jump(path, active)}>
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
