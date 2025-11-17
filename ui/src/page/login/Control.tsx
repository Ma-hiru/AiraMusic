import { FC, memo } from "react";
import ControlButton from "@mahiru/ui/page/layout/componets/ControlButton";
import { css, cx } from "@emotion/css";

const Control: FC<object> = () => {
  return (
    <div
      className={cx(
        "h-6 flex items-center justify-end absolute top-0 left-0 right-0 p-6 px-5",
        css`
          -webkit-app-region: drag;
        `
      )}>
      <ControlButton windowId={"login"} maximizable={false} />
    </div>
  );
};
export default memo(Control);
