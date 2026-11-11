import { cx, css } from "@emotion/css";
import { memo, type FC, type Ref, type HTMLAttributes } from "react";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  drag?: boolean;
}

/**
 * 可拖拽区域内的可交互区（按钮、滑块等）。
 *
 * - Electron：`-webkit-app-region: no-drag` 取消父级的拖动接管。
 * - Tauri：`data-tauri-drag-region="false"` 会在拖拽判定里直接返回 false，
 *   阻止冒泡到父级的 "deep" 拖拽区。
 */
const NoDrag: FC<DragProps> = ({ ref, className, drag = false, ...props }) => {
  return (
    <div
      ref={ref}
      className={cx(
        !drag &&
          css`
            -webkit-app-region: no-drag;
            app-region: no-drag;
          `,
        className
      )}
      data-tauri-drag-region={drag ? "deep" : "false"}
      {...props}
    />
  );
};

export default memo(NoDrag);
