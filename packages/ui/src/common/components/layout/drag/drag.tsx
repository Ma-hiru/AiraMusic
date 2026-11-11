import { cx, css } from "@emotion/css";
import { memo, type FC, type HTMLAttributes } from "react";

interface DragProps extends HTMLAttributes<HTMLDivElement> {
  drag?: boolean;
}

/**
 * 可拖拽区域。
 *
 * Electron 用 `-webkit-app-region: drag` 让 Chromium 接管窗口拖动；
 * Tauri（WKWebView / WebView2）不认这个属性，需要 `data-tauri-drag-region`
 * 交给宿主处理 —— 宿主侧监听 mousedown 后调用 startDragging。
 *
 * 注意 Tauri 的取值语义：
 * - 空值 / "true"：**只有直接点在元素本身**才拖（子元素会挡住）
 * - "deep"：子树任意位置都能拖（可点元素如 button/a 除外）
 * - "false"：显式禁止（NoDrag 用）
 *
 * 这里必须用 "deep"：各窗口的拖拽条里都有子元素（标题、按钮容器），
 * 用空值时点在子元素上不会触发拖动，表现为“窗口拖不动”。
 */
const Drag: FC<DragProps> = ({ className, drag = true, ...props }) => {
  return (
    <div
      className={cx(
        drag &&
          css`
            -webkit-app-region: drag;
            app-region: drag;
          `,
        className
      )}
      data-tauri-drag-region={drag ? "deep" : "false"}
      {...props}
    />
  );
};

export default memo(Drag);
