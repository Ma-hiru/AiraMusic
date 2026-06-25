import { type FC, memo, useCallback } from "react";
import { NavConstants } from "@/wins/main/constants";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { NeteaseUser } from "@/common/netease/models";
import { RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useSetAtom } from "jotai";
import { fmModeAtom, fmSessionAtom } from "@/wins/main/atoms/track";
import { playModalAtom } from "@/wins/main/atoms/layout";
import AppToast from "@/common/components/display/toast";

interface NavMenuProps {
  barOpened: boolean;
  className?: string;
}

const NavMenu: FC<NavMenuProps> = ({ barOpened, className }) => {
  const { jumpPlaylistPage, jumpHistoryPage } = usePageJump();
  const setPlayModal = useSetAtom(playModalAtom);
  const setFMMode = useSetAtom(fmModeAtom);
  const setFMSession = useSetAtom(fmSessionAtom);
  const location = useLocation();
  const navigate = useNavigate();

  const enableFM = useCallback(() => {
    setFMMode(true);
    setPlayModal(true);
    setFMSession((s) => s + 1);
    AppToast.show({
      type: "info",
      text: "开启漫游中..."
    });
  }, [setFMMode, setFMSession, setPlayModal]);

  const jump = useCallback(
    (path: string, active: boolean) => {
      if (active) return;
      if (path === RoutePathMain.history) return jumpHistoryPage();
      if (path === RoutePathMain.fm) {
        if (!NeteaseUser.isLoggedIn) {
          return AppToast.show({
            type: "info",
            text: "请先登录账号"
          });
        }
        return enableFM();
      }
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
    [enableFM, jumpHistoryPage, jumpPlaylistPage, navigate]
  );

  return (
    <div
      className={cx(
        "flex flex-col gap-2 w-(--side-bar-expand-width) overflow-hidden contain-layout",
        className
      )}>
      {NavConstants.LAYOUT_NAV.map(({ icon, label, path }) => {
        const active = RoutePathMain.matchPathname(location, path);
        return (
          <div
            key={path}
            title={label}
            className={cx(
              `
              flex flex-row h-12 items-center mx-3 rounded-md
              ease-in-out duration-300 transition-all
            `,
              active
                ? barOpened && "bg-primary text-(--text-color-on-main)"
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
                active ? "bg-primary" : !barOpened && "hover:bg-black/5"
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
