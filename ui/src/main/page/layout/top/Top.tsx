import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useUser } from "@mahiru/ui/public/store/user";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopLeft from "@mahiru/ui/main/page/layout/top/TopLeft";
import AppAuth from "@mahiru/ui/public/entry/auth";

import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";

const Top: FC<{ className?: string }> = ({ className }) => {
  const { layout, updateLayout } = useLayoutStore();
  const user = useUser();
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
            } else {
              AppAuth.createLoginWindow();
            }
          }}
        />
      </div>
      <div className="flex-1 flex flex-row gap-4 items-center justify-end">
        <TopSearch />
        {layout.playModal && <TopAvatar user={user} />}
        <TopDivider />
        <TopControl />
      </div>
    </Drag>
  );
};
export default memo(Top);
