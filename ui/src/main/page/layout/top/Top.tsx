import { FC, memo, useMemo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import { useUserStore } from "@mahiru/ui/public/store/user";
import { NeteaseUser } from "@mahiru/ui/public/models/netease";
import TopLeft from "@mahiru/ui/main/page/layout/top/TopLeft";
import AppRenderer from "@mahiru/ui/public/entry/renderer";
import NeteaseSource from "@mahiru/ui/public/entry/source";

const Top: FC<{ className?: string }> = ({ className }) => {
  const { layout, updateLayout } = useLayoutStore();
  const { _user, updateUser } = useUserStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);
  return (
    <Drag
      className={cx(
        `
          absolute left-0 right-0 top-0 pr-4
          flex items-center
        `,
        layout.playModal ? "text-white" : "text-[#7b8290]",
        className
      )}>
      <div
        className={cx(
          `
            h-full overflow-hidden
            duration-300 ease-in-out transition-all
          `,
          layout.sideBar ? "w-40" : "w-20"
        )}>
        <TopLeft
          user={user}
          layout={layout}
          onClick={() => {
            if (layout.playModal) {
              return updateLayout(layout.copy().setPlayModal(false));
            }
            if (!user?.isLoggedIn) {
              AppRenderer.event.openInternalWindow("login");
              AppRenderer.addMessageHandler(
                "login",
                "login",
                (cookies) => {
                  NeteaseSource.User.fromCookies(cookies).then(updateUser);
                },
                { once: true }
              );
            }
          }}
        />
      </div>
      <div className="flex-1 flex flex-row gap-4 items-center justify-end">
        <TopSearch />
        <TopAvatar user={user} />
        <TopDivider />
        <TopControl />
      </div>
    </Drag>
  );
};
export default memo(Top);
