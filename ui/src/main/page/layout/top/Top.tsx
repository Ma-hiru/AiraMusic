import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";

const Top: FC<object> = () => {
  const { layout } = useLayoutStore();
  return (
    <Drag
      className={cx(
        `
          absolute h-10 left-0 right-0 top-0 pr-4
          flex items-center opacity-50 z-10
        `,
        layout.playModal ? "text-white" : "text-[#7b8290]"
      )}>
      <div
        className={cx(
          `
            flex justify-center items-center h-full
            duration-300 ease-in-out transition-all
          `,
          layout.sideBar ? "w-40" : "w-20"
        )}>
        <TopAvatar />
      </div>
      <div className="flex-1 flex flex-row gap-4 items-center justify-end">
        <TopSearch />
        <TopAvatar />
        <TopDivider />
        <TopControl />
      </div>
    </Drag>
  );
};
export default memo(Top);
