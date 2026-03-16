import { FC, memo } from "react";
import { cx } from "@emotion/css";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

const Content: FC<object> = () => {
  const { layout, updateLayout } = useLayoutStore();
  return (
    <div
      className={cx(
        `
            relative flex-1 pb-18 pt-10
            ease-in-out duration-300 transition-all
          `,
        "bg-green-200"
      )}>
      <button
        className="active:scale-90 bg-amber-200 px-2 py-1 rounded-md hover:opacity-50 transition-all duration-300 ease-in-out"
        onClick={() => {
          updateLayout(layout.copy().setSideBar(!layout.sideBar));
        }}>
        change sidebar
      </button>
      <KeepAliveOutlet maxCache={3} />
    </div>
  );
};
export default memo(Content);
