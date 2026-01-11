import { FC, HTMLAttributes, memo } from "react";
import { css, cx } from "@emotion/css";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

const NoDrag: FC<DragProps> = ({ drag = false, className, ...props }) => {
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
