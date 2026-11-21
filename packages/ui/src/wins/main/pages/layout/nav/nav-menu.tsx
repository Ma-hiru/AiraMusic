import { cx } from "@emotion/css";
import { useSetAtom } from "jotai";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, type FC, useCallback, startTransition } from "react";
import { RoutePathMain } from "@/common/routes";
import { NavConstants } from "@/wins/main/constants";
import { NeteaseUser } from "@/common/netease/models";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { fmModeAtom, fmSessionAtom } from "@/wins/main/atoms/track";
import AppToast from "@/common/components/display/toast";

interface NavMenuProps {
  barOpened: boolean;
  className?: string;
}

const NavMenu: FC<NavMenuProps> = ({ className, barOpened }) => {
  const { jumpStarPage, jumpHistoryPage, jumpPlaylistPage } = usePageJump();
  const setPlayModal = useSetAtom(playModalAtom);
  const setFMMode = useSetAtom(fmModeAtom);
  const setFMSession = useSetAtom(fmSessionAtom);
  const location = useLocation();
  const navigate = useNavigate();

  const enableFM = useCallback(() => {
    startTransition(() => {
      setFMMode(true);
      setPlayModal(true);
      setFMSession((s) => s + 1);
    });
  }, [setFMMode, setFMSession, setPlayModal]);

  const jump = useCallback(
    (path: string, active: boolean) => {
      if (active) return;
      if (path === RoutePathMain.history) return jumpHistoryPage();
      if (path === RoutePathMain.star) {
        if (!NeteaseUser.isLoggedIn) {
          return AppToast.show({
            type: "info",
            text: "请先登录账号"
          });
        }
        return jumpStarPage();
      }
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
    [enableFM, jumpHistoryPage, jumpPlaylistPage, jumpStarPage, navigate]
  );

  return (
    <div
      className={cx(
        "flex flex-col gap-1.25 w-(--side-bar-expand-width) overflow-hidden contain-layout",
        className
      )}>
      {NavConstants.LAYOUT_NAV.map(({ icon, path, label }) => {
        const active = RoutePathMain.matchPathname(location, path, true);
        return (
          <button
            key={path}
            className={cx(
              `
              mx-3 flex h-12 cursor-pointer items-center rounded-md text-left
              transition-colors duration-200 focus-visible:bg-ink/12
            `,
              active
                ? cx("text-on-primary-container", barOpened && "bg-primary-container")
                : cx("text-ink", barOpened && "hover:bg-ink/12")
            )}
            title={label}
            type="button"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => jump(path, active)}>
            <span
              className={cx(
                `
                    relative flex h-full w-[calc(50%-var(--spacing)*3)] shrink-0 items-center justify-center rounded-md
                    transition-colors duration-200
                `,
                active &&
                  "text-m3-primary-80 before:absolute before:left-1 before:h-4 before:w-0.5 before:rounded-full before:bg-m3-primary-80",
                !barOpened && (active ? "bg-primary-container" : "hover:bg-ink/8")
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
          </button>
        );
      })}
    </div>
  );
};
export default memo(NavMenu);
