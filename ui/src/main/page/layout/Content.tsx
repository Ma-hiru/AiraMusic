import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";

const Content: FC<object> = () => {
  const { SideBarOpen } = useLayoutStore(["SideBarOpen"]);
  return (
    <div
      className={cx(
        "w-screen h-screen pb-18 z-9 relative ease-in-out duration-300 transition-all",
        SideBarOpen ? "pl-44" : "pl-22"
      )}>
      <KeepAliveOutlet maxCache={3} />
    </div>
  );
};
export default memo(Content);
