import { memo, HTMLAttributes } from "react";
import { css, cx } from "@emotion/css";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

export const Drag = memo(({ drag = true, className, ...props }: DragProps) => {
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
});

export const NoDrag = memo(({ drag = false, className, ...props }: DragProps) => {
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
});
