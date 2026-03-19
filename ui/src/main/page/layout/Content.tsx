import { FC, memo } from "react";
import { cx } from "@emotion/css";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";

const Content: FC<object> = () => {
  return (
    <div
      className={cx(
        `
            relative flex-1 pb-18 pt-10 bg-white
            ease-in-out duration-300 transition-all
          `
      )}>
      <KeepAliveOutlet maxCache={3} />
    </div>
  );
};
export default memo(Content);
