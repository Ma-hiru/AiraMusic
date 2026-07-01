import { cx, css } from "@emotion/css";
import { memo, type FC, type HTMLAttributes } from "react";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

const NoDrag: FC<DragProps> = ({ className, drag = false, ...props }) => {
  return (
    <div
      className={cx(
        !drag &&
          css`
            -webkit-app-region: no-drag;
          `,
        className
      )}
      {...props}
    />
  );
};

export default memo(NoDrag);
