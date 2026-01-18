import { FC, HTMLAttributes, memo } from "react";
import { css, cx } from "@emotion/css";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

const Drag: FC<DragProps> = ({ drag = true, className, ...props }) => {
  return (
    <div
      className={cx(
        drag &&
          css`
            -webkit-app-region: drag;
          `,
        className
      )}
      {...props}
    />
  );
};

export default memo(Drag);
