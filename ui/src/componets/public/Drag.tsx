import { FC, memo } from "react";
import { css, cx } from "@emotion/css";

const Drag: FC<object> = () => {
  return (
    <div
      className={cx(
        css`
          -webkit-app-region: drag;
        `,
        "absolute top-0 left-0 right-0 h-10"
      )}
    />
  );
};
export default memo(Drag);
