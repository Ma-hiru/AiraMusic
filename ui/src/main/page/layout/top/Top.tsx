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
          absolute h-10 left-0 right-0 top-0 px-4
          bg-pink-200 opacity-50 z-10
          flex items-center
        `,
        layout.playModal ? "text-white" : "text-[#7b8290]"
      )}>
      <div className="flex-1" />
      <div className="flex flex-row gap-4 items-center">
        <TopSearch />
        <TopAvatar />
        <TopDivider />
        <TopControl />
      </div>
    </Drag>
  );
};
export default memo(Top);
