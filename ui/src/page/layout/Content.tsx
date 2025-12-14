import { FC, memo } from "react";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { cx } from "@emotion/css";
import { useLayoutStatus } from "@mahiru/ui/store";

const Content: FC<object> = () => {
  const { sideBarOpen } = useLayoutStatus(["sideBarOpen"]);
  return (
    <div
      className={cx(
        "w-screen h-screen pb-18 z-9 relative ease-in-out duration-300 transition-all",
        sideBarOpen ? "pl-44" : "pl-22"
      )}>
      <KeepAliveOutlet maxCache={3} />
    </div>
  );
};
export default memo(Content);
