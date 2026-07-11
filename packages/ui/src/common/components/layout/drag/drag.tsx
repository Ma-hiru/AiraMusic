import { cx, css } from "@emotion/css";
import { memo, type FC, type HTMLAttributes } from "react";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

const Drag: FC<DragProps> = ({ className, drag = true, ...props }) => {
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
