import { FC, memo } from "react";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";

const Content: FC<object> = () => {
  const { sideBarOpen } = useLayout();
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
