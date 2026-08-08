import { cx, css } from "@emotion/css";
import { memo, type FC, type Ref, type HTMLAttributes } from "react";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  drag?: boolean;
}

const NoDrag: FC<DragProps> = ({ ref, className, drag = false, ...props }) => {
  return (
    <div
      ref={ref}
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
