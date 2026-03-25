import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import { useUser } from "@mahiru/ui/public/store/user";
import TopLeft from "@mahiru/ui/main/page/layout/top/TopLeft";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppWindow from "@mahiru/ui/public/entry/window";
import AppAuth from "@mahiru/ui/public/entry/auth";

const Top: FC<{ className?: string }> = ({ className }) => {
  const { layout, updateLayout } = useLayoutStore();
  const user = useUser();
  const loginWindow = useListenableHook(AppWindow.from("login"));
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
              loginWindow.openThen(() => {
                loginWindow.listen("login", AppAuth.login, { once: true, id: "login" });
              });
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
