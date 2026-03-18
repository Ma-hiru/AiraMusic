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

const Top: FC<object> = () => {
  const { layout, updateLayout } = useLayoutStore();
  const { _user } = useUserStore();
  const user = useMemo(() => NeteaseUser.fromObject(_user), [_user]);
  return (
    <Drag
      className={cx(
        `
          absolute h-10 left-0 right-0 top-0 pr-4
          flex items-center opacity-50 z-30
        `,
        layout.playModal ? "text-white" : "text-[#7b8290]"
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
